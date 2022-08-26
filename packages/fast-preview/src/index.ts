import { spawn, spawnSync } from "child_process";
import fs, { ReadStream } from "fs";
import { copyFile, readFile, rm } from "fs/promises";
import path, { dirname } from "path";
import MaxHeap from "./utils/max-heap";
import ProgressBar from "./utils/progress-bar";
import { escapePath, leftPad } from "./utils/string";

const mSpawn = (command: string, args?: ReadonlyArray<string>) => {
  return spawn(command, args, { windowsHide: true });
};

const mSpawnSync = (command: string, args?: ReadonlyArray<string>) => {
  return spawnSync(command, args, { windowsHide: true, encoding: "utf8" });
};

const Bar = new ProgressBar();

const CLIP_COUNT = 5;
const CLIP_TIME = 5;
const SPEED_MULTI = 2;
const TEMP_PATH = path.join(process.cwd(), ".tmp");
const CLIP_SELECT_STRATEGY = "max-size"; // max-size min-size random
const CLIP_RANGE = [0.1, 0.9];
const FPS_RATE = -1; // number
const DEFALUT_SIZE = -1;

const defaultOptions = {
  clip_count: CLIP_COUNT,
  clip_time: CLIP_TIME,
  clip_select_strategy: CLIP_SELECT_STRATEGY,
  clip_range: CLIP_RANGE,
  fps_rate: FPS_RATE,
  output: { type: "buffer" },
  speed_multi: SPEED_MULTI,
  width: DEFALUT_SIZE,
  height: DEFALUT_SIZE,
  log: true,
};

export interface FastPreviewOptions {
  clip_count?: number;
  clip_time?: number;
  clip_select_strategy?: string;
  clip_range?: number[];
  fps_rate?: number;
  output?: OutputOptions;
  speed_multi?: number;
  width?: number;
  height?: number;
  log?: boolean;
}

export interface OutputOptions {
  type: "dir" | "file" | "buffer";
  path: string;
}

export default class FastPreview {
  private static ffmpeg_path: string;
  private static ffprobe_path: string;
  private videoPath: string = "";
  private tempDir: string;
  private canMixAccel: boolean = true;
  private options: {
    clip_count: number;
    clip_time: number;
    clip_select_strategy: string;
    clip_range: number[];
    fps_rate: number;
    output: OutputOptions;
    speed_multi: number;
    width: number;
    height: number;
    log: boolean;
  };
  private hasScaleCudaFilter: boolean = false;
  private hasScaleNppFilter: boolean = false;

  public static setFfmpegPath(path: string) {
    FastPreview.ffmpeg_path = path;
  }
  public static setFfprobePath(path: string) {
    FastPreview.ffprobe_path = path;
  }

  constructor(
    readonly video: string | ReadStream,
    options?: FastPreviewOptions
  ) {
    if (!FastPreview.ffmpeg_path) {
      FastPreview.ffmpeg_path = process.env.FFMPEG_PATH || "ffmpeg";
    }

    if (!FastPreview.ffprobe_path) {
      FastPreview.ffprobe_path = process.env.FFPROBE_PATH || "ffprobe";
    }

    if (video instanceof fs.ReadStream) {
      this.video = video;
    } else {
      this.videoPath = video;
    }
    if (!this.video && !fs.existsSync(this.videoPath)) {
      throw new Error(`input video error`);
    }
    this.options = Object.assign({}, defaultOptions, options);
    ProgressBar.isShow = this.options.log;
    // this.clip_range =
    //   options.clip_range && options.clip_range.length >= 2
    //     ? options.clip_range
    //     : CLIP_RANGE;
    if (
      this.options.output.type === "dir" &&
      !fs.existsSync(this.options.output.path)
    ) {
      fs.mkdirSync(this.options.output.path, { recursive: true });
    } else if (
      this.options.output.type === "file" &&
      !fs.existsSync(dirname(this.options.output.path))
    ) {
      fs.mkdirSync(dirname(this.options.output.path), { recursive: true });
    }
    this.tempDir = TEMP_PATH;
    let idx = 0;
    while (fs.existsSync(this.tempDir)) {
      this.tempDir = path.join(process.cwd(), ".tmp" + idx++);
    }
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  checkHasGPU() {
    const rst = mSpawnSync("nvidia-smi", ["-L"]);
    if (rst.stderr) {
      console.log(rst.stderr);
      return;
    }
    return !!rst.stdout;
  }

  checkHasLibwebp() {
    const rst = mSpawnSync(`${FastPreview.ffmpeg_path}`, [
      "-hide_banner",
      "-codecs",
    ]);
    if (rst.stderr) {
      console.log(rst.stderr);
      return;
    }
    return rst.stdout.indexOf("libwebp") > -1;
  }

  checkHasCuda() {
    const rst = mSpawnSync(`${FastPreview.ffmpeg_path}`, [
      "-hide_banner",
      "-hwaccels",
    ]);
    if (rst.stderr) {
      console.log(rst.stderr);
      return;
    }
    return rst.stdout.indexOf("cuda") > -1;
  }

  checkHasScalenpp() {
    const rst = spawnSync(`${FastPreview.ffmpeg_path}`, [
      "-hide_banner",
      "-filters",
    ]);
    if (rst.stderr) {
      console.log(rst.stderr);
      return false;
    }
    return rst.stdout.indexOf("scale_npp") > -1;
  }

  checkHasScaleCuda() {
    const rst = spawnSync(`ffmpeg`, ["-hide_banner", "-filters"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (rst.stderr) {
      console.log(rst.stderr);
      return false;
    }
    return rst.stdout.indexOf("scale_cuda") > -1;
  }

  async exec() {
    try {
      if (!this.checkHasLibwebp()) {
        throw new Error("please enable libwebp");
      }

      this.hasScaleCudaFilter = this.checkHasScaleCuda();
      this.hasScaleNppFilter = this.checkHasScalenpp();
      if (
        !this.checkHasGPU() ||
        !this.checkHasCuda() ||
        (!this.hasScaleCudaFilter && !this.hasScaleNppFilter)
      ) {
        this.canMixAccel = false;
      } else {
        console.log("use mix acceleration");
      }

      if (typeof this.video !== "string") {
        this.videoPath = await this.writeVideo(this.video);
      }
      if (
        this.options.width !== DEFALUT_SIZE ||
        this.options.height !== DEFALUT_SIZE
      ) {
        await this.resizeVideo();
      }
      const data = await this.showSceneFrames();
      const [start, end] = this.options.clip_range.map(
        (item) => item * data.stream.duration_ts
      );
      const clips = await this.parseFrames(
        data.frames.filter((item: any) => {
          const pkt_frame = item.pkt_pts || item.pkt_dts;
          return pkt_frame >= start && pkt_frame <= end;
        })
      );
      await this.mergeClips(clips);
      const ans = await this.transToWebp();
      return ans;
    } catch (e: any) {
      throw e;
    } finally {
      await this.clear();
    }
  }

  writeVideo(stream: ReadStream): Promise<string> {
    const dist = path.join(this.tempDir, Date.now() + ".mp4");
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

    const dist = path.join(this.tempDir, Date.now() + ".mp4");

    let filter = "";
    if (this.canMixAccel && this.hasScaleNppFilter) {
      filter += `fade,hwupload_cuda,scale_npp=${this.options.width}:${this.options.height}:interp_algo=super`;
    } else if (this.canMixAccel && this.hasScaleCudaFilter) {
      filter += `fade,hwupload_cuda,scale_cuda=${this.options.width}:${this.options.height}`;
    } else {
      filter += `scale=${this.options.width}:${this.options.height}`;
    }
    if (
      this.options.width !== DEFALUT_SIZE &&
      this.options.height !== DEFALUT_SIZE
    ) {
      if(!this.hasScaleNppFilter){
        filter += `:force_original_aspect_ratio=decrease`;
      }else{
        filter += `:force_original_aspect_ratio=decrease,pad=${this.options.width}:${this.options.height}:(ow-iw)/2:(oh-ih)/2`;
      }
    }

    const params = [
      "-hide_banner",
      "-vsync",
      "0",
      "-c:v",
      this.canMixAccel ? "h264_cuvid" : "h264",
      "-i",
      this.videoPath,
      "-vf",
      filter,
      "-y",
      "-c:v",
      this.canMixAccel ? "h264_nvenc" : "libx264",
    ];
    let chunk = "";
    const result = spawn(FastPreview.ffmpeg_path, params.concat([dist]));
    return new Promise((resolve, reject) => {
      result.stderr.on("data", (data) => {
        chunk += data;
        const matched = chunk.match(/[\S\s]+time[\S\s]+?([\d\:]+)/);
        if (matched && matched[1]) {
          const time = matched[1];
          const [hour, minute, second] = time.split(":");
          Bar.update(Number(hour) * 360 + Number(minute) * 60 + Number(second));
        }
      });

      result.on("close", (code, msg) => {
        Bar.end();
        code === 0 ? resolve(dist) : reject(chunk);
      });
    });
  }

  snapshot(index: number, start: number, dur: number) {
    const dist = path.join(this.tempDir, `${leftPad(index, "0", 5)}.mp4`);
    console.log(`creating clip at ${start}: ${dist}`);
    Bar.init(dur);
    const params: any[] = [
      "-ss",
      start,
      "-t",
      dur,
      "-i",
      this.videoPath,
      "-an",
      "-vf",
      `setpts=${1 / this.options.speed_multi}*PTS`,
    ];
    if (this.options.fps_rate > 0) {
      params.push(...["-r", this.options.fps_rate]);
    }
    const result = mSpawn(FastPreview.ffmpeg_path, params.concat([dist]));
    return new Promise((resolve, reject) => {
      let chunk = "";
      let error = "";
      result.stdout.on("data", (data) => {
        chunk += data;
        const matched = chunk.match(/[\S\s]+time[\S\s]+?([\d\:]+)/);
        if (matched && matched[1]) {
          const time = matched[1];
          const [hour, minute, second] = time.split(":");
          Bar.update(Number(hour) * 360 + Number(minute) * 60 + Number(second));
        }
      });

      result.stderr.on("data", (data) => {
        error += data;
      });

      result.on("close", (code) => {
        Bar.end();
        if (code !== 0) {
          reject(error);
        } else {
          resolve(dist);
        }
      });
    });
  }

  mergeClips(clips: any[]): Promise<void> {
    const outputTXTPath = path.join(this.tempDir, `/output.txt`);
    const outputMP4Path = path.join(this.tempDir, `/output.mp4`);
    fs.writeFileSync(
      outputTXTPath,
      clips.map((item) => `file '${item}'`).join("\r\n"),
      { encoding: "utf8" }
    );
    const result = mSpawn(FastPreview.ffmpeg_path, [
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
    ]);
    return new Promise((resolve, reject) => {
      let error = "";
      result.stderr.on("data", (data) => {
        error += data;
      });
      result.on("close", (code) => {
        if (code !== 0) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  transToWebp() {
    const mp4 = path.join(this.tempDir, `output.mp4`);
    const webp = path.join(
      this.tempDir,
      `${path.basename(this.videoPath, ".mp4")}.webp`
    );
    console.log(`creating webp: ${webp}`);
    const stream = this.showStreams(mp4);
    return new Promise((resolve, reject) => {
      if (!stream) {
        reject("input has no streams");
        return;
      }
      Bar.init(stream.nb_frames);
      const params = [
        "-i",
        mp4,
        "-vcodec",
        "libwebp",
        "-vf",
        `fps=fps=20`,
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
        "-y",
        webp,
      ];
      const result = mSpawn(FastPreview.ffmpeg_path, params);
      let error = "";
      result.stderr.on("data", (data) => {
        error += data;
        const matched = data.toString().match(/^[\S\s]*frame=\s*(\d+)/);
        if (matched && matched[1]) {
          Bar.update(Number(matched[1]));
        }
      });

      result.on("close", async (code) => {
        Bar.end();
        let result;
        if (code !== 0) {
          reject(error);
        } else {
          const { output } = this.options;
          try {
            if (output.type === "file") {
              await copyFile(webp, output.path);
            } else if (output.type === "dir") {
              result = path.join(output.path, path.basename(webp));
              await copyFile(webp, result);
            } else {
              result = await readFile(webp);
            }
            resolve(result);
          } catch (e) {
            reject(e);
          }
        }
      });
    });
  }

  showStreams(videoPath: string) {
    const result = mSpawnSync(FastPreview.ffprobe_path, [
      "-v",
      "quiet",
      "-show_streams",
      "-select_streams",
      "v",
      "-of",
      "json",
      videoPath,
    ]);
    if (result.stderr) {
      console.error(result.stderr);
    }
    const { streams } = JSON.parse(String(result.stdout));
    return streams.length > 0 ? streams[0] : null;
  }

  showSceneFrames(): Promise<any> {
    console.log(`analyzing scene frames: ${this.videoPath}`);
    const stream = this.showStreams(this.videoPath);
    Bar.init(stream.duration_ts);
    let chunk = "";
    let error = "";
    const probe = mSpawn(FastPreview.ffprobe_path, [
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
    ]);
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
        error += data;
      });

      probe.on("close", (code) => {
        if (code !== 0) {
          Bar.end();
          reject(error);
        } else {
          const data = JSON.parse(chunk);
          if (data.frames.length > 0) {
            data.stream = stream;
            Bar.end();
            resolve(data);
          } else {
            this.showAllFrames(stream).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  showAllFrames(stream: any) {
    let chunk = "";
    let error = "";
    const probe = mSpawn(FastPreview.ffprobe_path, [
      "-v",
      "quiet",
      "-show_frames",
      "-select_streams",
      "v",
      "-of",
      "json",
      this.videoPath,
    ]);
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
        error += data;
      });

      probe.on("close", (code) => {
        Bar.end();
        if (code !== 0) {
          reject(error);
        } else {
          const data = JSON.parse(chunk);
          data.stream = stream;
          resolve(data);
        }
      });
    });
  }

  async parseFrames(frames: any[]) {
    const clips = [];
    frames = this.searchFrames(frames);
    for (let index = 0; index < frames.length; index++) {
      clips.push(
        await this.snapshot(
          index,
          Number(frames[index].pkt_pts_time || frames[index].pkt_dts_time),
          this.options.clip_time
        )
      );
    }
    return clips;
  }

  searchFrames(frames: any[]) {
    let temp: any[] = [];

    const hasRepeatClip = (target: any) =>
      temp.findIndex(
        (item) =>
          Math.abs(
            Number(target.pkt_pts_time || target.pkt_dts_time) -
              Number(item.pkt_pts_time || item.pkt_dts_time)
          ) < this.options.clip_time
      ) === -1;

    if (this.options.clip_select_strategy === "min-size") {
      const heap = new MaxHeap(
        frames,
        (a: any, b: any) => b.pkt_size - a.pkt_size
      );
      while (heap.size() > 0 && temp.length < this.options.clip_count) {
        const target = heap.pop();
        if (hasRepeatClip(target)) temp.push(target);
      }
    } else if (this.options.clip_select_strategy === "random") {
      frames = [...frames];
      while (frames.length > 0 && temp.length < this.options.clip_count) {
        const index = Math.floor(Math.random() * frames.length);
        const target = frames[index];
        if (hasRepeatClip(target)) temp.push(target);
        frames.splice(index, 1);
      }
    } else {
      const heap = new MaxHeap(
        frames,
        (a: any, b: any) => a.pkt_size - b.pkt_size
      );
      while (heap.size() > 0 && temp.length < this.options.clip_count) {
        const target = heap.pop();
        if (hasRepeatClip(target)) temp.push(target);
      }
    }
    temp.sort((a, b) => (a.pkt_pts || a.pkt_dts) - (b.pkt_pts || b.pkt_dts));
    return temp;
  }

  async clear() {
    await rm(this.tempDir, {
      recursive: true,
      maxRetries: 5,
      retryDelay: 5000,
    });
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
