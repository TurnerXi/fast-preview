const fs = require('fs')
const path = require('path')
const { path: ffmpeg_path } = require('@ffmpeg-installer/ffmpeg')
const { path: ffprobe_path } = require('@ffprobe-installer/ffprobe')
const { spawn, spawnSync } = require('child_process')
const { leftPad } = require('./utils/string')
const MaxHeap = require('./utils/max-heap')
const ProgressBar = require('./utils/progress-bar')

const Bar = new ProgressBar()

const SNAP_COUNT = 5
const THRESHOLD = 5
const DEFAULT_DIST = process.cwd()
const TEMP_PATH = path.join(process.cwd(), '.tmp')

module.exports = class FastPreview {
  constructor(videoPath, options = { count: SNAP_COUNT, seconds: THRESHOLD, dist_path: DEFAULT_DIST }) {
    this.videoPath = path.resolve(process.cwd(), videoPath)
    if (!fs.existsSync(this.videoPath)) {
      throw new Error(`can\`t found the video path: ${this.videoPath}`)
    }
    if (!fs.existsSync(options.dist_path)) {
      fs.mkdirSync(options.dist_path, { recursive: true })
    }
    if (fs.existsSync(TEMP_PATH)) {
      fs.rmdirSync(TEMP_PATH, { recursive: true })
    }
    fs.mkdirSync(TEMP_PATH, { recursive: true })
    this.filename = path.basename(videoPath, '.mp4')
    this.snapcount = options.count || SNAP_COUNT
    this.threshold = options.seconds || THRESHOLD
    this.distPath = options.dist_path || DEFAULT_DIST
    this.clips = []
  }

  async exec() {
    const data = await this.showPackets(this.videoPath)
    await this.parsePackets(data.packets.filter((item) => item.pts < data.stream.duration_ts / 2))
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

  showPackets(videoPath) {
    console.log('analyzing packets:')
    const stream = this.showStreams(videoPath)
    Bar.init(stream.duration_ts)
    let chunk = ''
    const probe = spawn(ffprobe_path, ['-v', 'quiet', '-show_packets', '-select_streams', 'v', '-of', 'json', videoPath], { encoding: 'utf8' })
    return new Promise((resolve, reject) => {
      probe.stdout.on('data', (data) => {
        chunk += data
        const lastPacket = JSON.parse(chunk.match(/[\S\s]+(\{[\S\s]+?\})/)[1])
        Bar.update(lastPacket.pts)
      })

      probe.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
        reject(data)
      })

      probe.on('close', (code) => {
        const data = JSON.parse(chunk)
        data.stream = stream
        code === 0 ? resolve(data) : reject(data)
      })
    })
  }

  async parsePackets(packets) {
    const heap = new MaxHeap(packets, (a, b) => a.size - b.size)
    const top = heap.top(this.snapcount).sort((a, b) => a.pts - b.pts)
    let index = 0
    let startTime = -1
    for (let i = 0; i < top.length; i++) {
      const item = top[i]
      const next = top[i + 1]
      if (next && Number(next.pts_time) - Number(item.pts_time) < this.threshold) {
        if (startTime === -1) {
          startTime = Number(next.pts_time)
        }
      } else {
        if (startTime === -1) {
          await this.snapshot(index, Number(item.pts_time), this.threshold)
        } else {
          await this.snapshot(index, startTime, Number(item.pts_time) - startTime + this.threshold)
          startTime = -1
        }
        index++
      }
    }
  }

  snapshot(index, start, dur) {
    const dist = path.join(TEMP_PATH, `${leftPad(index, '0', 5)}.mp4`)
    this.clips.push(dist)
    console.log(`snapshot ${dist}:`)
    Bar.init(dur)
    let chunk = ''
    const result = spawn(ffmpeg_path, ['-ss', start, '-t', dur, '-i', this.videoPath, dist], { encoding: 'utf8' })
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
    console.log(`transform to webp:`)
    const mp4 = path.join(TEMP_PATH, `output.mp4`)
    const webp = path.join(this.distPath, `${this.filename}.webp`)
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
        code === 0 ? resolve() : reject()
      })
    })
  }

  clear() {
    this.clips = []
    fs.rmdirSync(TEMP_PATH, { recursive: true, maxRetries: 5, retryDelay: 5000 })
  }
}

// packets
// "codec_type": "video",
// "stream_index": 0,
// "pts": 3356336,
// "pts_time": "139.847333",
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
// pkt_pts_time: '1.408000',
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
