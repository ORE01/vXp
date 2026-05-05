'use strict';

function isDebugEnabled() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  return env === 'development' || env === 'thomasdev';
}

function format(scope, message) {
  return scope ? `[${scope}] ${message}` : message;
}

const logger = {
  info(scope, message, data) {
    if (data !== undefined) {
      console.log(format(scope, message), data);
      return;
    }

    console.log(format(scope, message));
  },

  warn(scope, message, error) {
    if (error !== undefined) {
      console.warn(format(scope, message), error);
      return;
    }

    console.warn(format(scope, message));
  },

  error(scope, message, error) {
    if (error !== undefined) {
      console.error(format(scope, message), error);
      return;
    }

    console.error(format(scope, message));
  },

  debug(scope, message, data) {
    if (!isDebugEnabled()) return;

    if (data !== undefined) {
      console.log(format(scope, message), data);
      return;
    }

    console.log(format(scope, message));
  },
};

module.exports = { logger };