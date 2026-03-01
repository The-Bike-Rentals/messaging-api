const pino = require('pino');

const logger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: ['body.pass', 'body.password', 'body.apiKey', 'body.apiPassword'],
  },
  process.env.NODE_ENV !== 'production'
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
    : undefined
);

module.exports = logger;
