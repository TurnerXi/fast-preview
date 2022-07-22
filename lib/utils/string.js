"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapePath = exports.leftPad = void 0;
const leftPad = function (n, fullfill = "0", count = 1) {
    let str = String(n);
    while (str.length < count) {
        str = fullfill + str;
    }
    return str;
};
exports.leftPad = leftPad;
const escapePath = function (path) {
    return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
};
exports.escapePath = escapePath;
