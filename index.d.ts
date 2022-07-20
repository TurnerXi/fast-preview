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
      output?: string;
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
  exec(): Promise<string | Buffer>;
}
