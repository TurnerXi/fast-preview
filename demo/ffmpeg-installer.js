const { path: ffmpeg_path } = require('@ffmpeg-installer/ffmpeg')
const { path: ffprobe_path } = require('@ffprobe-installer/ffprobe')
const path = require('path')
const FastPreview = require('../index')
FastPreview.setFfmpegPath(ffmpeg_path)
FastPreview.setFfprobePath(ffprobe_path)
const preview = new FastPreview(path.resolve('D://download', 'testvideo.mp4'), {
  clip_count: 10,
  clip_time: 10,
  fps_rate: 10
})
preview.exec()
