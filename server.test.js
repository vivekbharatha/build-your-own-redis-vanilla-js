const net = require("net");
const assert = require("node:assert");
const { before, after, test } = require("node:test");
const { buildRedisCommand } = require("./utils");

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

    redisClient.write(buildRedisCommand(command));

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

test("should return $-1 for a non-existent key", async () => {
  const getResponse = await sendCommand("get foo1");
  assert.strictEqual(getResponse, "$-1\r\n");
});

test("should DEL a key", async () => {
  await sendCommand("set fooDel poorBar");
  const delResponse = await sendCommand("del fooDel");
  assert.strictEqual(delResponse, ":1\r\n");

  const getResponse = await sendCommand("get fooDel");
  assert.strictEqual(getResponse, "$-1\r\n");
});

test("should EXPIRE a key", async () => {
  await sendCommand("set fooExp expBar");
  const expireResponse = await sendCommand("expire fooExp 1");
  assert.strictEqual(expireResponse, ":1\r\n");

  await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for 1.1 seconds

  const getResponse = await sendCommand("get fooExp");
  assert.strictEqual(getResponse, "$-1\r\n");
});

test("should handle unknown commands gracefully", async () => {
  const response = await sendCommand("UNKNOWN test");
  assert.strictEqual(response, "-ERR unknown command\r\n");
});
