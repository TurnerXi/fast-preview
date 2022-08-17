const FastPreview = require("../lib").default;
new FastPreview("input.mp4", { width: 320 }).exec().then(console.log);
