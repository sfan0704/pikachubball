/* eslint-disable no-console -- the logger is the one place that writes to the console. */

/** Structured logger handed to code by the composition root. */
export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

/** Options the composition root chooses from configuration. */
export interface LoggerOptions {
  readonly debug: boolean;
}

/** Creates a logger; debug lines are written only when enabled. */
export function createLogger(options: LoggerOptions): Logger {
  const stamp = () => new Date().toISOString();
  return {
    debug: (message, ...details) => {
      if (options.debug) console.log(`${stamp()} [DEBUG] ${message}`, ...details);
    },
    info: (message, ...details) => console.log(`${stamp()} [INFO] ${message}`, ...details),
    warn: (message, ...details) => console.warn(`${stamp()} [WARN] ${message}`, ...details),
    error: (message, ...details) => console.error(`${stamp()} [ERROR] ${message}`, ...details),
  };
}

/**
 * Transitional default for modules that predate dependency injection (the
 * Yahoo client, league service, parsers and view services). Those modules
 * are replaced by CAR-101, CAR-63, CAR-102 and removed by CAR-117; new code
 * receives a Logger from the composition root instead.
 */
export const logger: Logger = createLogger({ debug: false });
