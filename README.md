# Fast Preview [![Build Status](https://api.travis-ci.org/TurnerXi/fast-preview.svg?branch=main)](http://travis-ci.org/TurnerXi/fast-preview)

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview?ref=badge_shield)

该库用于生成动态 webp 格式视频缩略图

## 条件

fast-preview 需要安装ffmpeg才能工作。
如果设置了 FFMPEG_PATH 环境变量, fast-preview 将使用它作为 ffmpeg 可执行文件的完整路径。否则，它将尝试直接调用 ffmpeg（因此它应该在您的 PATH 中）。您还必须安装 ffprobe（在大多数发行版中它带有 ffmpeg）。同样，如果设置了 FFPROBE_PATH 环境变量，fast-preview 将使用它，否则它将尝试在 PATH 中调用它。

#### 手动设置二进制路径

或者，您可以使用以下 API 命令手动设置 ffmpeg、ffprobe 二进制路径：
Ffmpeg.setFfmpegPath(path) 参数 path 是一个字符串，其中包含 ffmpeg 二进制文件的完整路径。
Ffmpeg.setFfprobePath(path) 参数 path 是一个字符串，其中包含 ffprobe 二进制文件的完整路径。

> 您也可以使用@ffmpeg-installer/ffmpeg和@ffprobe-installer/ffprobe，它们会自动下载您所在平台的ffmpeg和ffprobe并为您提供路径，详请见[demo/ffmpeg-installer.js](https://github.com/TurnerXi/fast-preview/blob/main/demo/ffmpeg-installer.js)

## CLI
```sh
$ npm install fast-preview
$ fpreview /path/to/video.mp4
```

## 安装

```sh
$ npm install fast-preview
```

### 使用

fast-preview 模块返回一个构造器，你需要实例化并传入要转换的视频（目前支持 MP4 格式）, 并使用实例调用 exec 方法

```js
var FastPreview = require('fast-preview').default
var preview = new FastPreview('video.mp4')
preview.exec()
```

你可以传入一些配置

```js
var FastPreview = require('fast-preview');
var preview = new FastPreview('video.mp4',{
  clip_count: 5,
  clip_time: 5,
  clip_select_strategy: 'max-size', // max-size min-size random
  clip_range: [0.1,0.9],
  fps_rate: 10, // number -1(default)
  output: {
    type: 'buffer' // 'buffer'(default) 'file' 'dir'
    path?: ''      // 输出类型不是buffer时需要传入文件或目录的路径
  },
  speed_multi: 2,
  width: 320, // number -1(default) 
  height: -1  // number -1(default)
});
preview.exec()
```

可以使用的 options:

- `clip_count`: 要截取的视频片段的数量
- `clip_time`: 每个片段持续时间(秒)
- `clip_select_strategy`: 片段选择策略
- `clip_range`: 片段选择范围(视频时间的百分比)
- `fps_rate`: 图像帧率(-1: 保持原视频帧率)
- `speed_multi`: 片段播放速度的倍数
- `output`: 动态预览图生成的路径或buffer
- `width`: 视频缩放宽度, 默认-1(按高度等比缩放)
- `height`: 视频缩放高度, 默认-1(按宽度等比缩放)

## License

(The MIT License)

Copyright (c) 2021 PingChuanXi &lt;silencetheseyears@foxmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview?ref=badge_large)
