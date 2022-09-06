const path = require("path");
const FastPreview = require("../lib").default;
new FastPreview(path.resolve(__dirname, "../input.mp4"), {
  width: 320,
  output: { type: "dir", path: path.resolve(__dirname, "../") },
})
  .exec()
  .then(console.log)
  .catch(console.error);
