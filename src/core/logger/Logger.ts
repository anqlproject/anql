import { getVersion } from '@tauri-apps/api/app';

import { getSystemInfo } from '../sysInfo/SystemInfo';
import { logStorage } from './LogStorage';
import { LogEntry, LogLevel, SystemInfo } from './LogTypes';

class Logger {
  private isDev = import.meta.env.DEV;
  private minLevel: LogLevel = this.isDev ? LogLevel.DEBUG : LogLevel.WARN;
  private errorLoggingEnabled = true;
  private sessionId: string;
  private appVersion: string | null = null;
  private systemInfo: SystemInfo | null = null;
  private startTime: string;

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.startTime = new Date().toISOString();
    this.initializeMetadata();
  }

  private async initializeMetadata() {
    try {
      this.appVersion = await getVersion();
      const systemInfo = await getSystemInfo();
      this.systemInfo = {
        platform: systemInfo.platform,
        version: systemInfo.version,
        arch: systemInfo.arch
      };
      console.log('[Logger] System info:', { appVersion: this.appVersion, systemInfo: this.systemInfo });
      
      // Initialize log file with system info
      logStorage.initializeLogFile(this.appVersion, this.systemInfo, this.sessionId, this.startTime);
    } catch (error) {
      console.error('[Logger] Failed to initialize logger metadata:', error);
      // Initialize with null values if Tauri fails
      logStorage.initializeLogFile(null, null, this.sessionId, this.startTime);
    }
  }

  setErrorLoggingEnabled(enabled: boolean) {
    this.errorLoggingEnabled = enabled;
  }

  private captureStackTrace(): string {
    const stack = new Error().stack;
    if (!stack) return '';
    const lines = stack.split('\n');
    return lines.slice(3, 6).join('\n');
  }

  private formatLog(level: LogLevel, message: string, context?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      stackTrace: this.captureStackTrace()
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.minLevel];
  }

  private async persistLog(entry: LogEntry, critical = false) {
    // Ne pas persister si error logging est désactivé (sauf pour les logs critiques)
    if (!this.errorLoggingEnabled && !critical) {
      return;
    }
    // En dev, on écrit quand même les logs pour tester
    logStorage.addLogEntry(entry);
    
    // Pour les logs critiques (ERROR), flush immédiat
    if (critical) {
      await logStorage.flush();
    }
  }

  private logToConsole(level: LogLevel, message: string, context?: any, error?: Error, stackTrace?: string) {
    const prefix = `[${level.toUpperCase()}] ${message}`;
    const data = { context, error, stack: stackTrace };

    switch (level) {
      case LogLevel.ERROR:
        console.error(prefix, data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, data);
        break;
      case LogLevel.INFO:
        console.log(prefix, data);
        break;
      case LogLevel.DEBUG:
        console.debug(prefix, data);
        break;
    }
  }

  error(message: string, error?: Error, context?: any) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.formatLog(LogLevel.ERROR, message, context, error);
    
    if (this.isDev) {
      this.logToConsole(LogLevel.ERROR, message, context, error, entry.stackTrace);
    }
    
    // ERROR logs sont critiques: flush immédiat pour éviter perte en cas de crash
    this.persistLog(entry, true);
  }

  warn(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.formatLog(LogLevel.WARN, message, context);
    
    if (this.isDev) {
      this.logToConsole(LogLevel.WARN, message, context, undefined, entry.stackTrace);
    }
    
    this.persistLog(entry);
  }

  info(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.formatLog(LogLevel.INFO, message, context);
    
    if (this.isDev) {
      this.logToConsole(LogLevel.INFO, message, context, undefined, entry.stackTrace);
    }
    
    this.persistLog(entry);
  }

  debug(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.formatLog(LogLevel.DEBUG, message, context);
    
    if (this.isDev) {
      this.logToConsole(LogLevel.DEBUG, message, context, undefined, entry.stackTrace);
    }
    
    this.persistLog(entry);
  }
}

export const logger = new Logger();
