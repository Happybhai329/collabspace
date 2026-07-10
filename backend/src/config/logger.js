/**
 * src/config/logger.js
 *
 * Winston-based structured logger.
 *
 * WHY Winston over console.log:
 * - Structured JSON output in production (machine-parseable for log aggregators like Datadog, Logtail)
 * - Log levels (debug, info, warn, error) allow environment-specific verbosity
 * - Daily rotating files prevent disk exhaustion
 * - Development mode uses colorized human-readable output
 * - Every log entry automatically includes timestamp and service name
 *
 * In production, logs flow: Winston → stdout → Docker/Render log collector → Aggregator
 */

import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './env.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Log Format Definitions ───────────────────────────────────────────────────

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/**
 * Development format: human-readable, colorized
 * Example: 2024-01-15 10:30:45 [INFO] Server started on port 5000
 */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  })
);

/**
 * Production format: structured JSON for log aggregators
 * Example: {"timestamp":"2024-01-15T10:30:45.000Z","level":"info","message":"...","service":"collabspace-api"}
 */
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Transports ───────────────────────────────────────────────────────────────

const transports = [
  // Always log to console
  new winston.transports.Console({
    format: config.isDev ? devFormat : prodFormat,
  }),
];

// In production, also write rotating log files
if (config.isProd) {
  const logDir = path.resolve(__dirname, '../../../logs');

  // Combined logs (all levels)
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d', // Retain for 14 days
      format: prodFormat,
    })
  );

  // Error-only log for quick debugging
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: prodFormat,
    })
  );
}

// ── Logger Instance ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: {
    service: 'collabspace-api',
    env: config.env,
  },
  transports,
  // Catch and log uncaught exceptions & promise rejections as last resort
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

export default logger;
