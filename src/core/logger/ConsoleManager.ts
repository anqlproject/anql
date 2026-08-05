const MAX_CONSOLE_ENTRIES = 1000;
const CLEAR_INTERVAL_MS = 60000; // 1 minute

class ConsoleManager {
  private entryCount = 0;
  private originalConsoleLog = console.log;
  private originalConsoleWarn = console.warn;
  private originalConsoleError = console.error;
  private originalConsoleDebug = console.debug;

  constructor() {
    this.interceptConsole();
    this.startPeriodicClear();
  }

  private interceptConsole() {
    console.log = (...args: any[]) => {
      this.entryCount++;
      this.originalConsoleLog.apply(console, args);
      this.checkAndClear();
    };

    console.warn = (...args: any[]) => {
      this.entryCount++;
      this.originalConsoleWarn.apply(console, args);
      this.checkAndClear();
    };

    console.error = (...args: any[]) => {
      this.entryCount++;
      this.originalConsoleError.apply(console, args);
      this.checkAndClear();
    };

    console.debug = (...args: any[]) => {
      this.entryCount++;
      this.originalConsoleDebug.apply(console, args);
      this.checkAndClear();
    };
  }

  private checkAndClear() {
    if (this.entryCount >= MAX_CONSOLE_ENTRIES) {
      console.clear();
      this.entryCount = 0;
      this.originalConsoleLog('[ConsoleManager] Console cleared due to entry limit');
    }
  }

  private startPeriodicClear() {
    setInterval(() => {
      if (this.entryCount > MAX_CONSOLE_ENTRIES / 2) {
        console.clear();
        this.entryCount = 0;
        this.originalConsoleLog('[ConsoleManager] Console cleared periodically');
      }
    }, CLEAR_INTERVAL_MS);
  }

  getEntryCount(): number {
    return this.entryCount;
  }

  reset() {
    this.entryCount = 0;
  }
}

export const consoleManager = new ConsoleManager();
