import { appendFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: Record<string, unknown>;
}

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor(logDir: string = 'logs', logFile: string = 'system.log') {
    this.logDir = logDir;
    this.logFile = join(logDir, logFile);
  }

  async init(): Promise<void> {
    await mkdir(this.logDir, { recursive: true });
  }

  async log(
    level: LogLevel,
    source: string,
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
    };

    const line = JSON.stringify(entry) + '\n';

    // Console output
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${source}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }

    // File output
    try {
      await appendFile(this.logFile, line);
    } catch {
      // Ignore file write errors
    }
  }

  async info(source: string, message: string, details?: Record<string, unknown>): Promise<void> {
    await this.log('info', source, message, details);
  }

  async warn(source: string, message: string, details?: Record<string, unknown>): Promise<void> {
    await this.log('warn', source, message, details);
  }

  async error(source: string, message: string, details?: Record<string, unknown>): Promise<void> {
    await this.log('error', source, message, details);
  }

  async debug(source: string, message: string, details?: Record<string, unknown>): Promise<void> {
    await this.log('debug', source, message, details);
  }
}
