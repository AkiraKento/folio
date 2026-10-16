export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  id: string;
  timestamp: number;
  isoTime: string;
  level: LogLevel;
  context: string;
  message: string;
  stack?: string;
}

export interface DiagnosticInfo {
  appVersion: string;
  platform: string;
  generatedAt: string;
  entriesCount: number;
  recentLogs: LogEntry[];
}
