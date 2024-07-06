const net = require("net");
const assert = require("node:assert");
const { before, after, test } = require("node:test");

let redisClient; // Redis client instance

const connectToRedis = () => {
  return new Promise((resolve, reject) => {
    redisClient = net.createConnection({ port: 6379 }, () => {
      resolve();
    });

    redisClient.on("error", (err) => {
      reject(err);
    });
  });
};

before(async () => {
  await connectToRedis();
});

after(() => {
  if (redisClient && !redisClient.destroyed) {
    redisClient.end();
  }
});

const onError = (err) => {
  reject(err);
};

const sendCommand = (command) => {
  return new Promise((resolve, reject) => {
    if (!redisClient || redisClient.destroyed) {
      reject(new Error("Client is not connected"));
      return;
    }

    redisClient.write(command);

    redisClient.once("data", (data) => {
      resolve(data.toString());
      redisClient.removeListener("error", onError);
    });

    redisClient.once("error", onError);
  });
};

test("should SET and GET a value", async () => {
  const setResponse = await sendCommand("set foo bar");
  assert.strictEqual(setResponse, "+OK\r\n");

  const getResponse = await sendCommand("get foo");
  assert.strictEqual(getResponse, "$3\r\nbar\r\n");
});
