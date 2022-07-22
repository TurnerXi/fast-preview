export default class MaxHeap {
    comparator: Function;
    stack: any[];
    constructor(arr: any[], comparator: Function);
    push(item: any): void;
    pop(): any;
    top(n: number): any[];
    size(): number;
    swap(idx1: number, idx2: number): void;
}
