import { env } from "../config/env";

/**
 * Structured logging utility
 * Provides consistent logging across the application
 */
export const logger = {
  /**
   * Debug level logging (only in development)
   */
  debug: (msg: string, ...args: any[]): void => {
    if (env.NODE_ENV === "development") {
      const formattedTime = formatTime();
      console.log(`${formattedTime} [DEBUG] ${msg}`, ...args);
    }
  },

  /**
   * Info level logging
   */
  info: (msg: string, ...args: any[]): void => {
    const formattedTime = formatTime();
    console.log(`${formattedTime} [INFO] ${msg}`, ...args);
  },

  /**
   * Warning level logging
   */
  warn: (msg: string, ...args: any[]): void => {
    const formattedTime = formatTime();
    console.warn(`${formattedTime} [WARN] ${msg}`, ...args);
  },

  /**
   * Error level logging
   */
  error: (msg: string, ...args: any[]): void => {
    const formattedTime = formatTime();
    console.error(`${formattedTime} [ERROR] ${msg}`, ...args);
  },
};

/**
 * Format current time for log messages
 */
function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

