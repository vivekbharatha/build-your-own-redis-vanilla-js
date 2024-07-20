const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const logger = require("./utils/logger.js")("persistence");

class Persistence {
  DATA_FILE = path.join(__dirname, "data.rdb");

  constructor() {
    this.store = {};
    this.expirationTimes = {};
  }

  async saveSnapshot() {
    const data = JSON.stringify({
      store: this.store,
      expirationTimes: this.expirationTimes,
    });

    try {
      await fsp.writeFile(this.DATA_FILE, data);
      logger.info(`Saved datastore to file: ${this.DATA_FILE}`);
    } catch (error) {
      logger.error(`Failed to save datastore: ${error.message}`);
    }
  }

  loadSnapshotSync() {
    if (!fs.existsSync(this.DATA_FILE)) return;

    try {
      const data = fs.readFileSync(this.DATA_FILE).toString();

      if (data) {
        const { store: loadedStore, expirationTimes: loadedExpirationTimes } =
          JSON.parse(data);

        Object.assign(this.store, loadedStore);
        Object.assign(this.expirationTimes, loadedExpirationTimes);

        logger.info("Datastore loaded successfully");
      }
    } catch (error) {
      logger.error(`Failed to load datastore: ${error.message}`);
    }
  }
}

module.exports = new Persistence();
