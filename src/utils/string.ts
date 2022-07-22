export const leftPad = function (
  n: number | string,
  fullfill = "0",
  count = 1
) {
  let str = String(n);
  while (str.length < count) {
    str = fullfill + str;
  }
  return str;
};

export const escapePath = function (path: string) {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
};
