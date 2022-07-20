const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { leftPad, escapePath } = require("./utils/string");
const MaxHeap = require("./utils/max-heap");
const ProgressBar = require("./utils/progress-bar");

const Bar = new ProgressBar();

const CLIP_COUNT = 5;
const CLIP_TIME = 5;
const SPEED_MULTI = 2;
const DEFAULT_DIST = process.cwd();
const TEMP_PATH = path.join(
  process.cwd(),
  ".tmp" + String(Date.now()).substring(-10)
);
const CLIP_SELECT_STRATEGY = "max-size"; // max-size min-size random
const CLIP_RANGE = [0.1, 0.9];
const FPS_RATE = 10; // 'keep' number
const DEFALUT_SIZE = -1;

module.exports = class FastPreview {
  constructor(
    video,
    options = {
      clip_count: CLIP_COUNT,
      clip_time: CLIP_TIME,
      clip_select_strategy: CLIP_SELECT_STRATEGY,
      clip_range: CLIP_RANGE,
      fps_rate: FPS_RATE,
      dist_path: DEFAULT_DIST,
      speed_multi: SPEED_MULTI,
      width: DEFALUT_SIZE,
      height: DEFALUT_SIZE,
    }
  ) {
    if (!FastPreview.ffmpeg_path) {
      this.ffmpeg_path = process.env.FFMPEG_PATH || "ffmpeg";
    } else {
      this.ffmpeg_path = FastPreview.ffmpeg_path;
    }

    if (!FastPreview.ffprobe_path) {
      this.ffprobe_path = process.env.FFPROBE_PATH || "ffprobe";
    } else {
      this.ffprobe_path = FastPreview.ffprobe_path;
    }
    if (video instanceof fs.ReadStream) {
      this.video = video;
    } else {
      this.videoPath = video;
    }
    if (!this.video && !fs.existsSync(this.videoPath)) {
      throw new Error(`input video error`);
    }
    this.clip_range =
      options.clip_range && options.clip_range.length >= 2
        ? options.clip_range
        : CLIP_RANGE;
    this.clip_select_strategy =
      options.clip_select_strategy || CLIP_SELECT_STRATEGY;
    this.speed_multi = options.speed_multi || SPEED_MULTI;
    this.clip_count = options.clip_count || CLIP_COUNT;
    this.clip_time = options.clip_time || CLIP_TIME;
    this.fps_rate = options.fps_rate || FPS_RATE;
    this.dist_path = options.dist_path || DEFAULT_DIST;
    this.width = options.width || DEFALUT_SIZE;
    this.height = options.height || DEFALUT_SIZE;
    if (!fs.existsSync(this.dist_path)) {
      fs.mkdirSync(this.dist_path, { recursive: true });
    }
    if (fs.existsSync(TEMP_PATH)) {
      fs.rmdirSync(TEMP_PATH, { recursive: true });
    }
    fs.mkdirSync(TEMP_PATH, { recursive: true });
  }

  async exec() {
    try {
      if (this.video) {
        this.videoPath = await this.writeVideo(this.video);
      }
      if (this.width !== DEFALUT_SIZE || this.height !== DEFALUT_SIZE) {
        await this.resizeVideo();
      }
      const data = await this.showSceneFrames();
      const [start, end] = this.clip_range.map(
        (item) => item * data.stream.duration_ts
      );
      const clips = await this.parseFrames(
        data.frames.filter((item) => {
          const pkt_frame = item.pkt_pts || item.pkt_dts;
          return pkt_frame >= start && pkt_frame <= end;
        })
      );
      await this.mergeClips(clips);
      await this.transToWebp();
      this.clear();
    } catch (e) {
      console.error(e);
    }
  }

  writeVideo(stream) {
    const dist = path.join(TEMP_PATH, Date.now() + ".mp4");
    const writable = fs.createWriteStream(dist);
    stream.pipe(writable);
    return new Promise((resolve) => {
      stream.on("end", () => {
        resolve(dist);
      });
    });
  }

  resizeVideo() {
    console.log(`resize video: ${this.videoPath}`);
    const stream = this.showStreams(this.videoPath);
    Bar.init(Number(stream.duration));

    const dist = path.join(TEMP_PATH, Date.now() + ".mp4");
    let chunk = "";
    const params = [
      "-y",
      "-i",
      this.videoPath,
      "-vf",
      `scale = ${this.width}: ${this.height}`,
    ];
    const result = spawn(this.ffmpeg_path, params.concat([dist]), {
      encoding: "utf8",
    });
    return new Promise((resolve, reject) => {
      result.stderr.on("data", (data) => {
        chunk += data;
        const matched = chunk.match(/[\S\s]+time[\S\s]+?([\d\:]+)/);
        if (matched && matched[1]) {
          const time = matched[1];
          const [hour, minute, second] = time.split(":");
          Bar.update(hour * 360 + minute * 60 + Number(second));
        }
      });

      result.on("close", (code, msg) => {
        fs.rmSync(this.videoPath);
        fs.renameSync(dist, this.videoPath);
        Bar.end();
        code === 0 ? resolve(dist) : reject(msg);
      });
    });
  }

  showStreams(videoPath) {
    const result = spawnSync(
      this.ffprobe_path,
      [
        "-v",
        "quiet",
        "-show_streams",
        "-select_streams",
        "v",
        "-of",
        "json",
        videoPath,
      ],
      { encoding: "utf8" }
    );
    if (result.stderr) {
      console.error(result.stderr);
    }
    const { streams } = JSON.parse(result.stdout);
    return streams[0];
  }

  showSceneFrames() {
    console.log(`analyzing scene frames: ${this.videoPath}`);
    const stream = this.showStreams(this.videoPath);
    Bar.init(stream.duration_ts);
    let chunk = "";
    const probe = spawn(
      this.ffprobe_path,
      [
        "-v",
        "quiet",
        "-show_frames",
        "-select_streams",
        "v",
        "-of",
        "json",
        "-f",
        "lavfi",
        `movie='${escapePath(this.videoPath)}',select='gt(scene\,.4)'`,
      ],
      {
        encoding: "utf8",
      }
    );
    return new Promise((resolve, reject) => {
      probe.stdout.on("data", (data) => {
        chunk += data;
        const match = chunk.match(/[\S\s]+(\{[\S\s]+?\{[\S\s]+?\}[\S\s]+?\})/);
        if (match) {
          const frame = JSON.parse(match[1]);
          Bar.update(frame.pkt_pts || frame.pkt_dts || 0);
        }
      });

      probe.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`);
        reject(data);
      });

      probe.on("close", (code) => {
        const data = JSON.parse(chunk);
        if (data.frames.length > 0) {
          data.stream = stream;
          Bar.end();
          code === 0 && resolve(data);
        } else {
          this.showAllFrames(stream).then(resolve).catch(reject);
        }
      });
    });
  }

  showAllFrames(stream) {
    let chunk = "";
    const probe = spawn(
      this.ffprobe_path,
      [
        "-v",
        "quiet",
        "-show_frames",
        "-select_streams",
        "v",
        "-of",
        "json",
        this.videoPath,
      ],
      { encoding: "utf8" }
    );
    return new Promise((resolve, reject) => {
      probe.stdout.on("data", (data) => {
        chunk += data;
        const match = chunk.match(/[\S\s]+(\{[\S\s]+?\})/);
        if (match) {
          const frame = JSON.parse(match[1]);
          Bar.update(frame.pkt_pts || frame.pkt_dts || 0);
        }
      });

      probe.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`);
        reject(data);
      });

      probe.on("close", (code) => {
        const data = JSON.parse(chunk);
        data.stream = stream;
        Bar.end();
        code === 0 && resolve(data);
      });
    });
  }

  async parseFrames(frames) {
    const clips = [];
    frames = this.searchFrames(frames);
    for (let index = 0; index < frames.length; index++) {
      clips.push(
        await this.snapshot(
          index,
          Number(frames[index].pkt_pts_time || frames[index].pkt_dts_time),
          this.clip_time
        )
      );
    }
    return clips;
  }

  searchFrames(frames) {
    let temp = [];

    const hasRepeatClip = (target) =>
      temp.findIndex(
        (item) =>
          Math.abs(
            Number(target.pkt_pts_time || target.pkt_dts_time) -
              Number(item.pkt_pts_time || item.pkt_dts_time)
          ) < this.clip_time
      ) === -1;

    if (this.clip_select_strategy === "min-size") {
      const heap = new MaxHeap(frames, (a, b) => b.pkt_size - a.pkt_size);
      while (heap.size() > 0 && temp.length < this.clip_count) {
        const target = heap.pop();
        if (hasRepeatClip(target)) temp.push(target);
      }
    } else if (this.clip_select_strategy === "random") {
      frames = [...frames];
      while (frames.length > 0 && temp.length < this.clip_count) {
        const index = Math.floor(Math.random() * frames.length);
        const target = frames[index];
        if (hasRepeatClip(target)) temp.push(target);
        frames.splice(index, 1);
      }
    } else {
      const heap = new MaxHeap(frames, (a, b) => a.pkt_size - b.pkt_size);
      while (heap.size() > 0 && temp.length < this.clip_count) {
        const target = heap.pop();
        if (hasRepeatClip(target)) temp.push(target);
      }
    }
    temp.sort((a, b) => (a.pkt_pts || a.pkt_dts) - (b.pkt_pts || b.pkt_dts));
    return temp;
  }

  snapshot(index, start, dur) {
    const dist = path.join(TEMP_PATH, `${leftPad(index, "0", 5)}.mp4`);
    console.log(`creating clip at ${start}: ${dist}`);
    Bar.init(dur);
    let chunk = "";
    const params = [
      "-ss",
      start,
      "-t",
      dur,
      "-i",
      this.videoPath,
      "-an",
      "-filter:v",
      `setpts=${1 / this.speed_multi}*PTS`,
    ];
    if (this.fps_rate !== "keep" && typeof this.fps_rate === "number") {
      params.push(...["-r", this.fps_rate]);
    }
    const result = spawn(this.ffmpeg_path, params.concat([dist]), {
      encoding: "utf8",
    });
    return new Promise((resolve, reject) => {
      result.stderr.on("data", (data) => {
        chunk += data;
        const matched = chunk.match(/[\S\s]+time[\S\s]+?([\d\:]+)/);
        if (matched && matched[1]) {
          const time = matched[1];
          const [hour, minute, second] = time.split(":");
          Bar.update(hour * 360 + minute * 60 + Number(second));
        }
      });

      result.on("close", (code) => {
        Bar.end();
        code === 0 ? resolve(dist) : reject();
      });
    });
  }

  mergeClips(clips) {
    const outputTXTPath = path.join(TEMP_PATH, `/output.txt`);
    const outputMP4Path = path.join(TEMP_PATH, `/output.mp4`);
    fs.writeFileSync(
      outputTXTPath,
      clips.map((item) => `file '${item}'`).join("\r\n"),
      { encoding: "utf8" }
    );
    const result = spawn(
      this.ffmpeg_path,
      [
        "-v",
        "quiet",
        "-safe",
        "0",
        "-f",
        "concat",
        "-i",
        outputTXTPath,
        "-c",
        "copy",
        outputMP4Path,
      ],
      { encoding: "utf8" }
    );
    return new Promise((resolve, reject) => {
      result.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`);
      });

      result.on("close", (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }

  transToWebp() {
    const mp4 = path.join(TEMP_PATH, `output.mp4`);
    const webp = path.join(
      this.dist_path,
      `${path.basename(this.videoPath, ".mp4")}.webp`
    );
    console.log(`creating webp: ${webp}`);
    const stream = this.showStreams(mp4);
    Bar.init(stream.nb_frames);
    return new Promise((resolve, reject) => {
      const result = spawn(
        this.ffmpeg_path,
        [
          "-i",
          mp4,
          "-vcodec",
          "libwebp",
          "-filter:v",
          "fps=fps=20",
          "-lossless",
          "0",
          "-compression_level",
          "3",
          "-q:v",
          "70",
          "-loop",
          "0",
          "-preset",
          "picture",
          "-an",
          "-vsync",
          "0",
          "-vf",
          "scale = 320:180:force_original_aspect_ratio = decrease,pad = 320:180:(ow-iw)/2:(oh-ih)/2",
          "-y",
          webp,
        ],
        { encoding: "utf8" }
      );
      result.stderr.on("data", (data) => {
        const matched = data.toString().match(/^[\S\s]*frame=\s*(\d+)/);
        if (matched && matched[1]) {
          Bar.update(Number(matched[1]));
        }
      });

      result.on("close", (code) => {
        Bar.end();
        code === 0 ? resolve() : reject();
      });
    });
  }

  clear() {
    fs.rmdirSync(TEMP_PATH, {
      recursive: true,
      maxRetries: 5,
      retryDelay: 5000,
    });
  }

  static setFfmpegPath(path) {
    FastPreview.ffmpeg_path = path;
  }
  static setFfprobePath(path) {
    FastPreview.ffprobe_path = path;
  }
};

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
