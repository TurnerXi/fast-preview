const path = require('path')
const FastPreview = require('../index')

const preview = new FastPreview(path.resolve(__dirname, './video.mp4'))
preview.exec()
