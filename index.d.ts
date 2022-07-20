export = FastPreview;
declare class FastPreview {
  static setFfmpegPath(path: any): void;
  static setFfprobePath(path: any): void;
  constructor(
    video: string | ReadStream,
    options?: {
      clip_count?: number;
      clip_time?: number;
      clip_select_strategy?: string;
      clip_range?: number[];
      fps_rate?: number;
      dist_path?: any;
      speed_multi?: number;
      width?: number;
      height?: number;
    }
  );
  ffmpeg_path: any;
  ffprobe_path: any;
  videoPath: any;
  filename: any;
  clip_range: number[];
  clip_select_strategy: string;
  speed_multi: number;
  clip_count: number;
  clip_time: number;
  fps_rate: number;
  dist_path: any;
  exec(): Promise<void>;
  showStreams(videoPath: any): any;
  showSceneFrames(videoPath: any): any;
  showAllFrames(stream: any, videoPath: any): any;
  parseFrames(frames: any): Promise<any[]>;
  searchFrames(frames: any): any[];
  snapshot(index: any, start: any, dur: any): any;
  mergeClips(clips: any): any;
  transToWebp(): any;
  clear(): void;
}
