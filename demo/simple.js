const FastPreview = require("../index");
new FastPreview("testvideo.mp4", { output: process.cwd() })
  .exec()
  .then(console.log);
