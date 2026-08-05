export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  stackTrace?: string;
}

export interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
}

export interface LogFile {
  appVersion: string | null;
  systemInfo: SystemInfo | null;
  sessionId: string;
  startTime: string;
  logs: LogEntry[];
}

export interface LogRotationConfig {
  maxFileSize: number;
  maxFiles: number;
  compressOld: boolean;
}

export const DEFAULT_ROTATION_CONFIG: LogRotationConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  compressOld: true
};
