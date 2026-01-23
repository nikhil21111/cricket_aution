/**
 * Structured logging utility for production debugging
 * 
 * Usage:
 *   import { logger } from './lib/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Bid failed', { error, teamId });
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LEVEL = import.meta.env.PROD ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

class Logger {
  constructor() {
    this.context = {};
  }

  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  log(level, message, data = {}) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
    };

    // In production, you can send to external service (e.g., Sentry, LogRocket)
    if (import.meta.env.PROD) {
      // Example: Send to external logging service
      // sendToLoggingService(logEntry);
    }

    // Console output
    const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](`[${level}] ${message}`, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }
}

export const logger = new Logger();

// Auction-specific logging helpers
export const logAuctionEvent = (event, data) => {
  logger.info(`Auction: ${event}`, {
    category: 'auction',
    ...data,
  });
};

export const logBidEvent = (event, data) => {
  logger.info(`Bid: ${event}`, {
    category: 'bid',
    ...data,
  });
};

export const logPlayerEvent = (event, data) => {
  logger.info(`Player: ${event}`, {
    category: 'player',
    ...data,
  });
};
