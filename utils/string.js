module.exports.leftPad = function (n, fullfill = '0', count = 1) {
  let str = String(n)
  while (str.length < count) {
    str = fullfill + str
  }
  return str
}
