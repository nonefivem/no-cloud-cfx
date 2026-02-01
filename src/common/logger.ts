import { config } from "./config";
import { LoggingLevel } from "./types";

export class Logger {
  private static readonly ENABLED = config.logging.enabled;
  private static readonly LEVEL = config.logging.level;
  private static readonly LEVELS: Record<LoggingLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private static shouldLog(level: LoggingLevel): boolean {
    if (!this.ENABLED) return false;

    return this.LEVELS[level] >= this.LEVELS[this.LEVEL];
  }

  static debug(name: string, message: string, ...args: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(`[${name}] [DEBUG]: ${message}`, ...args);
    }
  }

  static info(name: string, message: string, ...args: any[]) {
    if (this.shouldLog("info")) {
      console.info(`[${name}] [INFO]: ${message}`, ...args);
    }
  }

  static warn(name: string, message: string, ...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(`[${name}] [WARN]: ${message}`, ...args);
    }
  }

  static error(name: string, message: string, ...args: any[]) {
    if (this.shouldLog("error")) {
      console.error(`[${name}] [ERROR]: ${message}`, ...args);
    }
  }

  constructor(private readonly name: string) {}

  debug(message: string, ...args: any[]) {
    Logger.debug(this.name, message, ...args);
  }

  info(message: string, ...args: any[]) {
    Logger.info(this.name, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    Logger.warn(this.name, message, ...args);
  }

  error(message: string, ...args: any[]) {
    Logger.error(this.name, message, ...args);
  }
}
