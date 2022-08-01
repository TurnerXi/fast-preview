const FastPreview = require("../lib").default;
new FastPreview("testvideo.mp4", { output: process.cwd() })
  .exec()
  .then(console.log);
