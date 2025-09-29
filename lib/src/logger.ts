import pino from "pino";

// TODO if we can log filename as tag like `[pino] [filename] message` with pino
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    level: process.env.LOG_LEVEL || 'info',
    options: {
      colorize: true,
    },
  },
});
