/// <reference types="node" />
import { ReadStream } from "fs";
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
    readonly video: string | ReadStream;
    private static ffmpeg_path;
    private static ffprobe_path;
    private videoPath;
    private tempDir;
    private canMixAccel;
    private options;
    private hasScaleCudaFilter;
    private hasScaleNppFilter;
    static setFfmpegPath(path: string): void;
    static setFfprobePath(path: string): void;
    constructor(video: string | ReadStream, options?: FastPreviewOptions);
    checkHasGPU(): boolean | undefined;
    checkHasLibwebp(): boolean | undefined;
    checkHasCuda(): boolean | undefined;
    checkHasScalenpp(): boolean;
    checkHasScaleCuda(): boolean;
    exec(): Promise<unknown>;
    writeVideo(stream: ReadStream): Promise<string>;
    resizeVideo(): Promise<unknown>;
    snapshot(index: number, start: number, dur: number): Promise<unknown>;
    mergeClips(clips: any[]): Promise<void>;
    transToWebp(): Promise<unknown>;
    showStreams(videoPath: string): any;
    showSceneFrames(): Promise<any>;
    showAllFrames(stream: any): Promise<unknown>;
    parseFrames(frames: any[]): Promise<unknown[]>;
    searchFrames(frames: any[]): any[];
    clear(): Promise<void>;
}
