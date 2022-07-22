"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { bgWhite } = require("chalk");
class ProgressBar {
    constructor() {
        this.total = 0;
        this.current = 0;
        this.bar_length = process.stdout.columns - 30;
    }
    init(total) {
        this.total = total;
        this.current = 0;
        this.update(this.current);
    }
    update(current) {
        this.current = current;
        const current_progress = this.current / this.total;
        this.draw(current_progress);
    }
    draw(current_progress) {
        const filled_bar_length = Math.floor(current_progress * this.bar_length);
        const empty_bar_length = this.bar_length - filled_bar_length;
        const filled_bar = this.get_bar(filled_bar_length, " ", bgWhite);
        const empty_bar = this.get_bar(empty_bar_length, "-");
        const percentage_progress = (current_progress * 100).toFixed(2);
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`Current progress: [${filled_bar}${empty_bar}] | ${percentage_progress}%`);
    }
    end() {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    }
    get_bar(length, char, color = (a) => a) {
        let str = "";
        for (let i = 0; i < length; i++) {
            str += char;
        }
        return color(str);
    }
}
exports.default = ProgressBar;
