export class Logger {
    private static debugMode = false;

    public static setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    public static debug(message: string, ...args: any[]): void {
        if (this.debugMode) {
            console.log(`[DataBlock] ${message}`, ...args);
        }
    }

    public static info(message: string, ...args: any[]): void {
        console.log(`[DataBlock] ${message}`, ...args);
    }

    public static warn(message: string, ...args: any[]): void {
        console.warn(`[DataBlock] ${message}`, ...args);
    }

    public static error(message: string, ...args: any[]): void {
        console.error(`[DataBlock] ${message}`, ...args);
    }
}