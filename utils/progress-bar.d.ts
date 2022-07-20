export = ProgressBar;
declare class ProgressBar {
    bar_length: number;
    init(total: any): void;
    total: any;
    current: any;
    update(current: any): void;
    draw(current_progress: any): void;
    get_bar(length: any, char: any, color?: (a: any) => any): any;
}
