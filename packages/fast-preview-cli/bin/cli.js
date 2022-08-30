#!/usr/bin/env node
const { dirname } = require("path");
const program = require("commander");
const FastPreview = require("fast-preview").default;
const { Option } = program;

program
  .argument("<files...>")
  .addOption(
    new Option("-c, --clip-count <number>", "设置要截取的视频片段的数量")
      .default(5)
      .argParser(parseFloat)
  )
  .addOption(
    new Option("-t, --clip-time <number>", "每个片段持续时间(秒)")
      .default(5)
      .argParser(parseFloat)
  )
  .addOption(
    new Option("-s, --clip-strategy <strategy>", "片段选择策略")
      .choices(["max-size", "min-size", "random"])
      .default("max-size")
  )
  .addOption(
    new Option(
      "-r, --clip-range <numbers...>",
      "片段选择范围(视频时间的百分比)"
    ).default([0.1, 0.9])
  )
  .addOption(
    new Option(
      "-f, --fps-rate <number>",
      "图像帧率(-1: 保持原视频帧率)"
    ).default(10)
  )
  .addOption(
    new Option(
      "-o, --output <path>",
      "动态预览图存放的目录, 默认输出到输入文件目录"
    )
  )
  .addOption(
    new Option("-m, --speed-multi <number>", "片段播放速度的倍数").default(2)
  )
  .addOption(
    new Option(
      "-w, --width <number>",
      "视频缩放宽度, 默认-1(按高度等比缩放)"
    ).default(-1)
  )
  .addOption(
    new Option(
      "--height <number>",
      "视频缩放高度, 默认-1(按宽度等比缩放)"
    ).default(-1)
  )
  .action(async function (files, options) {
    try {
      for (const file of files) {
        const preview = new FastPreview(file, {
          clip_count: options.clipCount,
          clip_time: options.clipTime,
          clip_select_strategy: options.clipStrategy,
          clip_range: options.clipRange,
          fps_rate: options.fpsRate,
          output: {
            type: "dir",
            path: options.output || dirname(file),
          },
          speed_multi: options.speedMulti,
          width: options.width,
          height: options.height,
          progress: true,
          debug: true,
        });

        await preview.exec();
      }
    } catch (e) {
      console.error("failed: " + e);
    }
  });

program.parse(process.argv);
