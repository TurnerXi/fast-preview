const { bgWhite } = require("chalk");
var readline = require("readline");

const rl = readline.createInterface(process.stdout);

export default class ProgressBar {
  static isShow: boolean = true;
  bar_length: number;
  total: number = 0;
  current: number = 0;
  constructor() {
    this.bar_length = process.stdout.columns - 30;
  }

  init(total: number) {
    this.total = total;
    this.current = 0;
    this.update(this.current);
  }

  update(current: number) {
    this.current = current;
    const current_progress = this.current / this.total;
    ProgressBar.isShow && this.draw(current_progress);
  }

  draw(current_progress: number) {
    const filled_bar_length = Math.floor(current_progress * this.bar_length);
    const empty_bar_length = this.bar_length - filled_bar_length;

    const filled_bar = this.get_bar(filled_bar_length, " ", bgWhite);
    const empty_bar = this.get_bar(empty_bar_length, "-");
    const percentage_progress = (current_progress * 100).toFixed(2);

    rl.clearLine(0);
    rl.cursorTo(0);
    process.stdout.write(
      `Current progress: [${filled_bar}${empty_bar}] | ${percentage_progress}%`
    );
  }

  end() {
    if (ProgressBar.isShow) {
      rl.clearLine(0);
      rl.cursorTo(0);
    }
  }

  get_bar(length: number, char: string, color = (a: string) => a) {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += char;
    }
    return color(str);
  }
}
