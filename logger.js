const debugNamespaces = (process.env.DEBUG || "*")
  .split(",")
  .map((ns) => ns.trim());

const logger = (namespace) => {
  const log = (mode, message) => {
    const logMessage = `${new Date().toISOString()} ${mode} [${namespace}]: ${message}`;

    if (mode === "error") {
      console.error(logMessage);
      return;
    }

    if (debugNamespaces.includes("*") || debugNamespaces.includes(namespace)) {
      console[mode](logMessage);
    }
  };

  return {
    info: (message) => log("log", message),
    error: (message) => log("error", message),
    warn: (message) => log("warn", message),
    debug: (message) => log("debug", message),
  };
};

module.exports = logger;
