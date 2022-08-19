const path = require("path");
const FastPreview = require("../lib").default;
const fs = require("fs");

const stream = fs.createReadStream(path.resolve(__dirname, "../testvideo.mp4"));

const preview = new FastPreview(stream, {
  output: { type: "dir", path: process.cwd() },
  clip_count: 10,
  clip_time: 10,
  fps_rate: 10,
  width: 320,
});
preview.exec().then(console.log).catch(console.error);
