export = MaxHeap;
declare class MaxHeap {
    constructor(arr: any, comparator: any);
    comparator: any;
    stack: any[];
    push(item: any): void;
    pop(): any;
    top(n: any): any[];
    size(): number;
    swap(idx1: any, idx2: any): void;
}
