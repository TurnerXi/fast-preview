"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const promises_1 = require("fs/promises");
const path_1 = __importStar(require("path"));
const max_heap_1 = __importDefault(require("./utils/max-heap"));
const progress_bar_1 = __importDefault(require("./utils/progress-bar"));
const string_1 = require("./utils/string");
const mSpawn = (command, args) => {
    return (0, child_process_1.spawn)(command, args, { windowsHide: true });
};
const mSpawnSync = (command, args) => {
    return (0, child_process_1.spawnSync)(command, args, { windowsHide: true, encoding: "utf8" });
};
const Bar = new progress_bar_1.default();
const CLIP_COUNT = 5;
const CLIP_TIME = 5;
const SPEED_MULTI = 2;
const TEMP_PATH = path_1.default.join(process.cwd(), ".tmp");
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
    progress: true,
    debug: true,
};
class FastPreview {
    constructor(video, options) {
        this.video = video;
        this.videoPath = "";
        this.canMixAccel = true;
        this.hasScaleCudaFilter = false;
        this.hasScaleNppFilter = false;
        if (!FastPreview.ffmpeg_path) {
            FastPreview.ffmpeg_path = process.env.FFMPEG_PATH || "ffmpeg";
        }
        if (!FastPreview.ffprobe_path) {
            FastPreview.ffprobe_path = process.env.FFPROBE_PATH || "ffprobe";
        }
        if (video instanceof fs_1.default.ReadStream) {
            this.video = video;
        }
        else {
            this.videoPath = video;
        }
        if (!this.video && !fs_1.default.existsSync(this.videoPath)) {
            throw new Error(`input video error`);
        }
        this.options = Object.assign({}, defaultOptions, options);
        progress_bar_1.default.isShow = this.options.progress || !!this.options.log;
        // this.clip_range =
        //   options.clip_range && options.clip_range.length >= 2
        //     ? options.clip_range
        //     : CLIP_RANGE;
        if (this.options.output.type === "dir" &&
            !fs_1.default.existsSync(this.options.output.path)) {
            fs_1.default.mkdirSync(this.options.output.path, { recursive: true });
        }
        else if (this.options.output.type === "file" &&
            !fs_1.default.existsSync((0, path_1.dirname)(this.options.output.path))) {
            fs_1.default.mkdirSync((0, path_1.dirname)(this.options.output.path), { recursive: true });
        }
        this.tempDir = TEMP_PATH;
        let idx = 0;
        while (fs_1.default.existsSync(this.tempDir)) {
            this.tempDir = path_1.default.join(process.cwd(), ".tmp" + idx++);
        }
        fs_1.default.mkdirSync(this.tempDir, { recursive: true });
    }
    static setFfmpegPath(path) {
        FastPreview.ffmpeg_path = path;
    }
    static setFfprobePath(path) {
        FastPreview.ffprobe_path = path;
    }
    debug(...msg) {
        if (this.options.debug) {
            console.log(...msg);
        }
    }
    checkHasGPU() {
        const rst = mSpawnSync("nvidia-smi", ["-L"]);
        if (rst.stderr) {
            this.debug(rst.stderr);
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
            this.debug(rst.stderr);
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
            this.debug(rst.stderr);
            return;
        }
        return rst.stdout.indexOf("cuda") > -1;
    }
    checkHasScalenpp() {
        const rst = (0, child_process_1.spawnSync)(`${FastPreview.ffmpeg_path}`, [
            "-hide_banner",
            "-filters",
        ]);
        if (rst.stderr) {
            this.debug(rst.stderr);
            return false;
        }
        return rst.stdout.indexOf("scale_npp") > -1;
    }
    checkHasScaleCuda() {
        const rst = (0, child_process_1.spawnSync)(`ffmpeg`, ["-hide_banner", "-filters"], {
            encoding: "utf8",
            windowsHide: true,
        });
        if (rst.stderr) {
            this.debug(rst.stderr);
            return false;
        }
        return rst.stdout.indexOf("scale_cuda") > -1;
    }
    exec() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.checkHasLibwebp()) {
                    throw new Error("please enable libwebp");
                }
                this.hasScaleCudaFilter = this.checkHasScaleCuda();
                this.hasScaleNppFilter = this.checkHasScalenpp();
                if (!this.checkHasGPU() ||
                    !this.checkHasCuda() ||
                    (!this.hasScaleCudaFilter && !this.hasScaleNppFilter)) {
                    this.canMixAccel = false;
                }
                else {
                    this.debug("use mix acceleration");
                }
                if (typeof this.video !== "string") {
                    this.videoPath = yield this.writeVideo(this.video);
                }
                if (this.options.width !== DEFALUT_SIZE ||
                    this.options.height !== DEFALUT_SIZE) {
                    this.videoPath = yield this.resizeVideo();
                }
                const data = yield this.showSceneFrames();
                const [start, end] = this.options.clip_range.map((item) => item * data.stream.duration_ts);
                const clips = yield this.parseFrames(data.frames.filter((item) => {
                    const pkt_frame = item.pkt_pts || item.pkt_dts;
                    return pkt_frame >= start && pkt_frame <= end;
                }));
                yield this.mergeClips(clips);
                const ans = yield this.transToWebp();
                return ans;
            }
            catch (e) {
                throw e;
            }
            finally {
                yield this.clear();
            }
        });
    }
    writeVideo(stream) {
        const dist = path_1.default.join(this.tempDir, Date.now() + ".mp4");
        const writable = fs_1.default.createWriteStream(dist);
        stream.pipe(writable);
        return new Promise((resolve) => {
            stream.on("end", () => {
                resolve(dist);
            });
        });
    }
    resizeVideo() {
        this.debug(`resize video: ${this.videoPath}`);
        const stream = this.showStreams(this.videoPath);
        Bar.init(Number(stream.duration));
        const dist = path_1.default.join(this.tempDir, Date.now() + ".mp4");
        let filter = "";
        if (this.canMixAccel && this.hasScaleNppFilter) {
            filter += `fade,hwupload_cuda,scale_npp=${this.options.width}:${this.options.height}:interp_algo=super`;
        }
        else if (this.canMixAccel && this.hasScaleCudaFilter) {
            filter += `fade,hwupload_cuda,scale_cuda=${this.options.width}:${this.options.height}`;
        }
        else {
            filter += `scale=${this.options.width}:${this.options.height}`;
        }
        if (this.options.width !== DEFALUT_SIZE &&
            this.options.height !== DEFALUT_SIZE) {
            if (!this.canMixAccel || this.hasScaleNppFilter) {
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
        const result = (0, child_process_1.spawn)(FastPreview.ffmpeg_path, params.concat([dist]));
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
    snapshot(index, start, dur) {
        const dist = path_1.default.join(this.tempDir, `${(0, string_1.leftPad)(index, "0", 5)}.mp4`);
        this.debug(`creating clip at ${start}: ${dist}`);
        Bar.init(dur);
        const params = [
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
                }
                else {
                    resolve(dist);
                }
            });
        });
    }
    mergeClips(clips) {
        const outputTXTPath = path_1.default.join(this.tempDir, `/output.txt`);
        const outputMP4Path = path_1.default.join(this.tempDir, `/output.mp4`);
        fs_1.default.writeFileSync(outputTXTPath, clips.map((item) => `file '${item}'`).join("\r\n"), { encoding: "utf8" });
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
                }
                else {
                    resolve();
                }
            });
        });
    }
    transToWebp() {
        const mp4 = path_1.default.join(this.tempDir, `output.mp4`);
        const webp = path_1.default.join(this.tempDir, `${path_1.default.basename(this.videoPath, ".mp4")}.webp`);
        this.debug(`creating webp: ${webp}`);
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
            result.on("close", (code) => __awaiter(this, void 0, void 0, function* () {
                Bar.end();
                let result;
                if (code !== 0) {
                    reject(error);
                }
                else {
                    const { output } = this.options;
                    try {
                        if (output.type === "file") {
                            yield (0, promises_1.copyFile)(webp, output.path);
                        }
                        else if (output.type === "dir") {
                            result = path_1.default.join(output.path, path_1.default.basename(webp));
                            yield (0, promises_1.copyFile)(webp, result);
                        }
                        else {
                            result = yield (0, promises_1.readFile)(webp);
                        }
                        resolve(result);
                    }
                    catch (e) {
                        reject(e);
                    }
                }
            }));
        });
    }
    showStreams(videoPath) {
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
    showSceneFrames() {
        this.debug(`analyzing scene frames: ${this.videoPath}`);
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
            `movie='${(0, string_1.escapePath)(this.videoPath)}',select='gt(scene\,.4)'`,
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
                }
                else {
                    const data = JSON.parse(chunk);
                    if (data.frames.length > 0) {
                        data.stream = stream;
                        Bar.end();
                        resolve(data);
                    }
                    else {
                        this.showAllFrames(stream).then(resolve).catch(reject);
                    }
                }
            });
        });
    }
    showAllFrames(stream) {
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
                }
                else {
                    const data = JSON.parse(chunk);
                    data.stream = stream;
                    resolve(data);
                }
            });
        });
    }
    parseFrames(frames) {
        return __awaiter(this, void 0, void 0, function* () {
            const clips = [];
            frames = this.searchFrames(frames);
            for (let index = 0; index < frames.length; index++) {
                clips.push(yield this.snapshot(index, Number(frames[index].pkt_pts_time || frames[index].pkt_dts_time), this.options.clip_time));
            }
            return clips;
        });
    }
    searchFrames(frames) {
        let temp = [];
        const hasRepeatClip = (target) => temp.findIndex((item) => Math.abs(Number(target.pkt_pts_time || target.pkt_dts_time) -
            Number(item.pkt_pts_time || item.pkt_dts_time)) < this.options.clip_time) === -1;
        if (this.options.clip_select_strategy === "min-size") {
            const heap = new max_heap_1.default(frames, (a, b) => b.pkt_size - a.pkt_size);
            while (heap.size() > 0 && temp.length < this.options.clip_count) {
                const target = heap.pop();
                if (hasRepeatClip(target))
                    temp.push(target);
            }
        }
        else if (this.options.clip_select_strategy === "random") {
            frames = [...frames];
            while (frames.length > 0 && temp.length < this.options.clip_count) {
                const index = Math.floor(Math.random() * frames.length);
                const target = frames[index];
                if (hasRepeatClip(target))
                    temp.push(target);
                frames.splice(index, 1);
            }
        }
        else {
            const heap = new max_heap_1.default(frames, (a, b) => a.pkt_size - b.pkt_size);
            while (heap.size() > 0 && temp.length < this.options.clip_count) {
                const target = heap.pop();
                if (hasRepeatClip(target))
                    temp.push(target);
            }
        }
        temp.sort((a, b) => (a.pkt_pts || a.pkt_dts) - (b.pkt_pts || b.pkt_dts));
        return temp;
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, promises_1.rm)(this.tempDir, {
                recursive: true,
                maxRetries: 5,
                retryDelay: 5000,
            });
        });
    }
}
exports.default = FastPreview;
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
