const path = require('path')
const FastPreview = require('../index')

const preview = new FastPreview(path.resolve(__dirname, './video.mp4'), {
  clip_select_strategy: 'max-size',
  clip_count: 10
})
preview.exec()
