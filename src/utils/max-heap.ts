export default class MaxHeap {
  comparator: Function;
  stack: any[];
  constructor(arr: any[], comparator: Function) {
    this.comparator = comparator;
    this.stack = [];
    for (const item of arr) {
      this.push(item);
    }
  }

  push(item: any) {
    this.stack.push(item);
    let index = this.stack.length - 1;
    let pIndex = Math.floor((index - 1) / 2);
    while (
      index > 0 &&
      this.comparator(this.stack[index], this.stack[pIndex]) > 0
    ) {
      this.swap(index, pIndex);
      index = pIndex;
      pIndex = Math.floor((index - 1) / 2);
    }
  }

  pop() {
    if (this.stack.length === 0) return;
    const top = this.stack[0];
    this.swap(0, this.stack.length - 1);
    this.stack.pop();
    let index = 0;
    let target = index * 2 + 1;
    while (target < this.stack.length) {
      if (
        this.stack[target + 1] &&
        this.comparator(this.stack[target + 1], this.stack[target]) > 0
      ) {
        target += 1;
      }
      if (this.comparator(this.stack[index], this.stack[target]) > 0) {
        break;
      }
      this.swap(index, target);
      index = target;
      target = index * 2 + 1;
    }
    return top;
  }

  top(n: number) {
    const ans = [];
    while (n) {
      ans.push(this.pop());
      n--;
    }
    return ans;
  }

  size() {
    return this.stack.length;
  }

  swap(idx1: number, idx2: number) {
    [this.stack[idx1], this.stack[idx2]] = [this.stack[idx2], this.stack[idx1]];
  }
}
