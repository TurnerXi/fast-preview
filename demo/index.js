const path = require('path')
const FastPreview = require('../index')

const preview = new FastPreview(path.resolve(__dirname, './video.mp4'), {
  clip_count: 10,
  clip_time: 10,
  fps_rate: 10
})
preview.exec()
