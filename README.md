# Fast Preview [![Build Status](https://api.travis-ci.org/TurnerXi/fast-preview.svg?branch=main)](http://travis-ci.org/TurnerXi/fast-preview)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Ffluent-ffmpeg%2Fnode-fluent-ffmpeg.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Ffluent-ffmpeg%2Fnode-fluent-ffmpeg?ref=badge_shield)

该库用于生成动态webp格式视频缩略图

## 安装

```sh
$ npm install fast-preview
```

### 使用

fast-preview模块返回一个构造器，你需要实例化并传入要转换的视频（目前支持MP4格式）, 并使用实例调用exec方法

```js
var FastPreview = require('fast-preview');
var preview = new FastPreview('video.mp4');
preview.exec()
```

你可以传入一些配置

```js
var FastPreview = require('fast-preview');
var preview = new FastPreview('video.mp4',{
  count: 10,
  seconds: 10,
  dist_path: path.resolve(__dirname,'thumbnails')
});
preview.exec()
```

可以使用的options:
* `count`: 要截取的视频片段的数量
* `seconds`: 每个片段持续时间(秒)
* `dist_path`: webp生成的路径

## License

(The MIT License)

Copyright (c) 2021 PingChuanXi &lt;silencetheseyears@foxmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FTurnerXi%2Ffast-preview?ref=badge_large)
