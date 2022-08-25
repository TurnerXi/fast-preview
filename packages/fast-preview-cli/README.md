# `fast-preview-cli`

## Install
```sh
npm install -g fast-preview-cli
```
Or
```sh
$ npm install fast-preview
```

```js
var FastPreview = require("fast-preview").default;
var preview = new FastPreview("video.mp4");
preview.exec();
```

## Usage

```
fpreview --help

Usage: cli [options] <files...>

Options:
  -c, --clip-count <number>       设置要截取的视频片段的数量 (default: 5)
  -t, --clip-time <number>        每个片段持续时间(秒) (default: 5)
  -s, --clip-strategy <strategy>  片段选择策略 (choices: "max-size", "min-size", "random", default: "max-size")
  -r, --clip-range <numbers...>   片段选择范围(视频时间的百分比) (default: [0.1,0.9])
  -f, --fps-rate <number>         图像帧率(-1: 保持原视频帧率) (default: 10)
  -o, --output <path>             动态预览图存放的目录, 默认输出到输入文件目录
  -m, --speed-multi <number>      片段播放速度的倍数 (default: 2)
  -w, --width <number>            视频缩放宽度, 默认-1(按高度等比缩放) (default: -1)
  -h, --height <number>           视频缩放高度, 默认-1(按宽度等比缩放) (default: -1)
  --help                          display help for command
```

## Example
```
fpreview /path/to/video.mp4
```
