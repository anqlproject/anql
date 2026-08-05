import { BaseDirectory, exists, mkdir, readTextFile, writeFile } from '@tauri-apps/plugin-fs';

import { LogEntry, LogFile } from './LogTypes';

const LOG_FILE = 'app-logs.json';
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const FLUSH_INTERVAL_MS = 30000; // 30 seconds
const BUFFER_FLUSH_THRESHOLD = 50; // Flush when buffer has 50 logs

class LogStorage {
  private logDirectory: string | null = null;
  private currentLogFile: LogFile | null = null;

  setLogDirectory(directory: string) {
    this.logDirectory = directory;
  }

  private getLogPath(): string {
    if (this.logDirectory) {
      return `${this.logDirectory}/${LOG_FILE}`;
    }
    return LOG_FILE;
  }

  constructor() {
    // Flush périodique toutes les 30 secondes (au lieu de 5 secondes)
    setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
    // Flush au déchargement de la page
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  initializeLogFile(appVersion: string | null, systemInfo: any, sessionId: string, startTime: string) {
    this.currentLogFile = {
      appVersion,
      systemInfo,
      sessionId,
      startTime,
      logs: []
    };
  }

  addLogEntry(entry: LogEntry) {
    if (this.currentLogFile) {
      this.currentLogFile.logs.push(entry);
      
      // Flush when buffer reaches threshold
      if (this.currentLogFile.logs.length >= BUFFER_FLUSH_THRESHOLD) {
        this.flush();
      }
    }
  }

  async flush(): Promise<void> {
    if (!this.currentLogFile || this.currentLogFile.logs.length === 0) return;

    try {
      const logPath = this.getLogPath();
      const encoder = new TextEncoder();
      const content = JSON.stringify(this.currentLogFile, null, 2);
      
      if (this.logDirectory) {
        const dirExists = await exists(this.logDirectory);
        if (!dirExists) {
          await mkdir(this.logDirectory, { recursive: true });
        }
        await writeFile(logPath, encoder.encode(content));
      } else {
        await writeFile(logPath, encoder.encode(content), { 
          baseDir: BaseDirectory.AppData
        });
      }
    } catch (error) {
      console.error('[LogStorage] Failed to flush logs:', error);
    }
  }

  async getLogFile(): Promise<LogFile | null> {
    try {
      const logPath = this.getLogPath();
      const existsFile = this.logDirectory 
        ? await exists(logPath)
        : await exists(logPath, { baseDir: BaseDirectory.AppData });
      
      if (!existsFile) {
        return null;
      }

      const content = this.logDirectory
        ? await readTextFile(logPath)
        : await readTextFile(logPath, { baseDir: BaseDirectory.AppData });
      
      return JSON.parse(content) as LogFile;
    } catch (error) {
      console.error('Failed to read log file:', error);
      return null;
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    const logFile = await this.getLogFile();
    return logFile?.logs || [];
  }

  async clearLogs(): Promise<void> {
    try {
      const logPath = this.getLogPath();
      const encoder = new TextEncoder();
      
      if (this.logDirectory) {
        await writeFile(logPath, encoder.encode(''));
      } else {
        await writeFile(logPath, encoder.encode(''), { baseDir: BaseDirectory.AppData });
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  async exportLogs(): Promise<string> {
    const logFile = await this.getLogFile();
    return logFile ? JSON.stringify(logFile, null, 2) : '';
  }

  async cleanupIfTooLarge(): Promise<void> {
    try {
      const logPath = this.getLogPath();
      const fileExists = this.logDirectory
        ? await exists(logPath)
        : await exists(logPath, { baseDir: BaseDirectory.AppData });
      
      if (!fileExists) return;

      const content = this.logDirectory
        ? await readTextFile(logPath)
        : await readTextFile(logPath, { baseDir: BaseDirectory.AppData });
      
      const sizeInBytes = new TextEncoder().encode(content).length;
      
      if (sizeInBytes > MAX_LOG_SIZE_BYTES && this.currentLogFile) {
        const keepCount = Math.floor(this.currentLogFile.logs.length / 2);
        this.currentLogFile.logs = this.currentLogFile.logs.slice(-keepCount);
        await this.flush();
      }
    } catch (error) {
      console.error('[LogStorage] Failed to cleanup logs:', error);
    }
  }
}

export const logStorage = new LogStorage();
