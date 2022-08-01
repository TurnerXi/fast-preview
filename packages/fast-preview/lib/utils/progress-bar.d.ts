export default class ProgressBar {
    static isShow: boolean;
    bar_length: number;
    total: number;
    current: number;
    constructor();
    init(total: number): void;
    update(current: number): void;
    draw(current_progress: number): void;
    end(): void;
    get_bar(length: number, char: string, color?: (a: string) => string): string;
}
