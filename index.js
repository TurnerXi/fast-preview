const fs = require('fs')
const path = require('path')
const { path: ffmpeg_path } = require('@ffmpeg-installer/ffmpeg')
const { path: ffprobe_path } = require('@ffprobe-installer/ffprobe')
const { spawn, spawnSync } = require('child_process')
const { leftPad, escapePath } = require('./utils/string')
const MaxHeap = require('./utils/max-heap')
const ProgressBar = require('./utils/progress-bar')

const Bar = new ProgressBar()

const CLIP_COUNT = 5
const CLIP_TIME = 5
const SPEED_MULTI = 2
const DEFAULT_DIST = process.cwd()
const TEMP_PATH = path.join(process.cwd(), '.tmp')
const CLIP_SELECT_STRATEGY = 'max-size' // max-size min-size random
const CLIP_RANGE = [0.1, 0.9]

module.exports = class FastPreview {
  constructor(
    videoPath,
    options = {
      clip_count: CLIP_COUNT,
      clip_time: CLIP_TIME,
      clip_select_strategy: CLIP_SELECT_STRATEGY,
      clip_range: CLIP_RANGE,
      dist_path: DEFAULT_DIST,
      speed_multi: SPEED_MULTI
    }
  ) {
    this.videoPath = path.resolve(process.cwd(), videoPath)
    if (!fs.existsSync(this.videoPath)) {
      throw new Error(`can\`t found the video path: ${this.videoPath}`)
    }
    this.filename = path.basename(videoPath, '.mp4')
    this.clip_range = options.clip_range && options.clip_range.length >= 2 ? options.clip_range : CLIP_RANGE
    this.clip_select_strategy = options.clip_select_strategy || CLIP_SELECT_STRATEGY
    this.speed_multi = options.speed_multi || SPEED_MULTI
    this.clip_count = options.clip_count || CLIP_COUNT
    this.clip_time = options.clip_time || CLIP_TIME
    this.dist_path = options.dist_path || DEFAULT_DIST
    this.clips = []
    if (!fs.existsSync(this.dist_path)) {
      fs.mkdirSync(this.dist_path, { recursive: true })
    }
    if (fs.existsSync(TEMP_PATH)) {
      fs.rmdirSync(TEMP_PATH, { recursive: true })
    }
    fs.mkdirSync(TEMP_PATH, { recursive: true })
  }

  async exec() {
    const data = await this.showSceneFrames(this.videoPath)
    const [start, end] = this.clip_range.map((item) => item * data.stream.duration_ts)
    await this.parseFrames(data.frames.filter((item) => item.pkt_pts >= start && item.pkt_pts <= end))
    await this.mergeClips()
    await this.transToWebp()
    this.clear()
  }

  showStreams(videoPath) {
    const result = spawnSync(ffprobe_path, ['-v', 'quiet', '-show_streams', '-select_streams', 'v', '-of', 'json', videoPath], { encoding: 'utf8' })
    if (result.stderr) {
      console.error(result.stderr)
    }
    const { streams } = JSON.parse(result.stdout)
    return streams[0]
  }

  showSceneFrames(videoPath) {
    console.log(`analyzing frames: ${videoPath}`)
    const stream = this.showStreams(videoPath)
    Bar.init(stream.duration_ts)
    let chunk = ''
    const probe = spawn(ffprobe_path, ['-v', 'quiet', '-show_frames', '-select_streams', 'v', '-of', 'json', '-f', 'lavfi', `movie='${escapePath(this.videoPath)}',select='gt(scene\,.4)'`], {
      encoding: 'utf8'
    })
    return new Promise((resolve, reject) => {
      probe.stdout.on('data', (data) => {
        chunk += data
        const lastPacket = JSON.parse(chunk.match(/[\S\s]+(\{[\S\s]+?\{[\S\s]+?\}[\S\s]+?\})/)[1])
        Bar.update(lastPacket.pkt_pts)
      })

      probe.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
        reject(data)
      })

      probe.on('close', (code) => {
        const data = JSON.parse(chunk)
        data.stream = stream
        code === 0 && Bar.update(stream.duration_ts)
        code === 0 ? resolve(data) : reject(data)
      })
    })
  }

  async parseFrames(frames) {
    const clips = this.findClips(frames)
    let index = 0
    let startTime = -1
    for (let i = 0; i < clips.length && index < this.clip_count; i++) {
      const item = clips[i]
      const next = clips[i + 1]
      if (next && Number(next.pkt_pts_time) - Number(item.pkt_pts_time) < this.clip_time) {
        if (startTime === -1) {
          startTime = Number(next.pkt_pts_time)
        }
      } else {
        if (startTime === -1) {
          await this.snapshot(index, Number(item.pkt_pts_time), this.clip_time)
        } else {
          await this.snapshot(index, startTime, Number(item.pkt_pts_time) - startTime + this.clip_time)
          startTime = -1
        }
        index++
      }
    }
  }

  findClips(frames) {
    let clips = []
    if (this.clip_select_strategy === 'min-size') {
      const heap = new MaxHeap(frames, (a, b) => b.pkt_size - a.pkt_size)
      while (clips.length < this.clip_count) {
        const target = heap.top(1)[0]
        const idx = clips.findIndex((item) => Math.abs(Number(target.pkt_pts_time) - Number(item.pkt_pts_time)) < this.clip_time)
        if (idx === -1) {
          clips.push(target)
        }
      }
    } else if (this.clip_select_strategy === 'random') {
      while (clips.length < this.clip_count) {
        const target = clips[Math.floor(Math.random() * frames.length)]
        const idx = clips.findIndex((item) => Math.abs(Number(target.pkt_pts_time) - Number(item.pkt_pts_time)) < this.clip_time)
        if (idx === -1) {
          clips.add(target)
        }
      }
    } else {
      const heap = new MaxHeap(frames, (a, b) => a.pkt_size - b.pkt_size)
      while (clips.length < this.clip_count) {
        const target = heap.top(1)[0]
        const idx = clips.findIndex((item) => Math.abs(Number(target.pkt_pts_time) - Number(item.pkt_pts_time)) < this.clip_time)
        if (idx === -1) {
          clips.push(target)
        }
      }
    }
    clips.sort((a, b) => a.pkt_pts - b.pkt_pts)
    return clips
  }

  snapshot(index, start, dur) {
    const dist = path.join(TEMP_PATH, `${leftPad(index, '0', 5)}.mp4`)
    this.clips.push(dist)
    console.log(`creating clip: ${dist}`)
    Bar.init(dur)
    let chunk = ''
    const result = spawn(ffmpeg_path, ['-ss', start, '-t', dur, '-i', this.videoPath, '-an', '-filter:v', `setpts=${1 / this.speed_multi}*PTS`, dist], { encoding: 'utf8' })
    return new Promise((resolve, reject) => {
      result.stderr.on('data', (data) => {
        chunk += data
        const matched = chunk.match(/[\S\s]+time[\S\s]+?([\d\:]+)/)
        if (matched && matched[1]) {
          const time = matched[1]
          const [hour, minute, second] = time.split(':')
          Bar.update(hour * 360 + minute * 60 + Number(second))
        }
      })

      result.on('close', (code) => {
        code === 0 && Bar.update(dur)
        code === 0 ? resolve() : reject()
      })
    })
  }

  mergeClips() {
    const outputTXTPath = path.join(TEMP_PATH, `/output.txt`)
    const outputMP4Path = path.join(TEMP_PATH, `/output.mp4`)
    fs.writeFileSync(outputTXTPath, this.clips.map((item) => `file '${item}'`).join('\r\n'), { encoding: 'utf8' })
    const result = spawn(ffmpeg_path, ['-v', 'quiet', '-safe', '0', '-f', 'concat', '-i', outputTXTPath, '-c', 'copy', outputMP4Path], { encoding: 'utf8' })
    return new Promise((resolve, reject) => {
      result.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
      })

      result.on('close', (code) => {
        code === 0 ? resolve() : reject()
      })
    })
  }

  transToWebp() {
    const mp4 = path.join(TEMP_PATH, `output.mp4`)
    const webp = path.join(this.dist_path, `${this.filename}.webp`)
    console.log(`creating webp: ${webp}`)
    const stream = this.showStreams(mp4)
    Bar.init(stream.nb_frames)
    return new Promise((resolve, reject) => {
      const result = spawn(
        ffmpeg_path,
        [
          '-i',
          mp4,
          '-vcodec',
          'libwebp',
          '-filter:v',
          'fps=fps=20',
          '-lossless',
          '0',
          '-compression_level',
          '3',
          '-q:v',
          '70',
          '-loop',
          '0',
          '-preset',
          'picture',
          '-an',
          '-vsync',
          '0',
          '-vf',
          'scale = 320:180:force_original_aspect_ratio = decrease,pad = 320:180:(ow-iw)/2:(oh-ih)/2',
          '-y',
          webp
        ],
        { encoding: 'utf8' }
      )
      result.stderr.on('data', (data) => {
        const matched = data.toString().match(/^[\S\s]*frame=\s*(\d+)/)
        if (matched && matched[1]) {
          Bar.update(Number(matched[1]))
        }
      })

      result.on('close', (code) => {
        code === 0 && Bar.update(stream.nb_frames)
        code === 0 ? resolve() : reject()
      })
    })
  }

  clear() {
    this.clips = []
    fs.rmdirSync(TEMP_PATH, { recursive: true, maxRetries: 5, retryDelay: 5000 })
  }
}

// frames
// "codec_type": "video",
// "stream_index": 0,
// "pts": 3356336,
// "pkt_pts_time": "139.847333",
// "dts": 3355335,
// "dts_time": "139.805625",
// "duration": 1001,
// "duration_time": "0.041708",
// "size": "7092",
// "pos": "45987819",
// "flags": "__"

// frames
// media_type: 'audio',
// stream_index: 1,
// key_frame: 1,
// pkt_pts: 67584,
// pkt_pkt_pts_time: '1.408000',
// pkt_dts: 67584,
// pkt_dts_time: '1.408000',
// best_effort_timestamp: 67584,
// best_effort_timestamp_time: '1.408000',
// pkt_duration: 1024,
// pkt_duration_time: '0.021333',
// pkt_pos: '1254160',
// pkt_size: '152',
// sample_fmt: 'fltp',
// nb_samples: 1024,
// channels: 2,
// channel_layout: 'stereo
