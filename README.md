# Fast Preview [![Build Status](https://api.travis-ci.org/TurnerXi/fast-preview.svg?branch=main)](http://travis-ci.org/TurnerXi/fast-preview)

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Ffluent-ffmpeg%2Fnode-fluent-ffmpeg.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Ffluent-ffmpeg%2Fnode-fluent-ffmpeg?ref=badge_shield)

该库用于生成动态 webp 格式视频缩略图

## 安装

```sh
$ npm install fast-preview
```

### 使用

fast-preview 模块返回一个构造器，你需要实例化并传入要转换的视频（目前支持 MP4 格式）, 并使用实例调用 exec 方法

```js
var FastPreview = require('fast-preview')
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
  dist_path: __dirname,
  speed_multi: 2
});
preview.exec()
```

可以使用的 options:

- `clip_count`: 要截取的视频片段的数量
- `clip_time`: 每个片段持续时间(秒)
- `clip_select_strategy`: 片段选择策略
- `clip_range`: 片段选择范围(视频时间的百分比)
- `speed_multi`: 片段播放速度的倍数
- `dist_path`: 动态预览图生成的路径

## License

(The MIT License)

Copyright (c) 2021 PingChuanXi &lt;silencetheseyears@foxmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview?ref=badge_large)
