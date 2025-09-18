import pino from "pino";

// TODO if we can log filename as tag like `[pino] [filename] message` with pino
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
