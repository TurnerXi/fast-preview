const path = require("path");
const FastPreview = require("../lib").default;
new FastPreview(path.resolve(__dirname, "../input.mp4"), { width: 320 })
  .exec()
  .then(console.log)
  .catch(console.error);
