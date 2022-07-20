const { path: ffmpeg_path } = require("@ffmpeg-installer/ffmpeg");
const { path: ffprobe_path } = require("@ffprobe-installer/ffprobe");
const path = require("path");
const FastPreview = require("../index");
const fs = require("fs");

FastPreview.setFfmpegPath(ffmpeg_path);
FastPreview.setFfprobePath(ffprobe_path);
const stream = fs.createReadStream(path.resolve(__dirname, "../testvideo.mp4"));
const preview = new FastPreview(stream, {
  clip_count: 10,
  clip_time: 10,
  fps_rate: 10,
  width: 320,
});
preview.exec();
