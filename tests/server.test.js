const net = require("net");
const assert = require("node:assert");
const { before, after, test } = require("node:test");
const { buildRedisCommand } = require("../src/utils");

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

test("should return correct TTL for a key and error cases", async () => {
  await sendCommand("set fooT expT");
  const expireResponse = await sendCommand("expire fooT 5");
  assert.strictEqual(expireResponse, ":1\r\n");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const getResponse = await sendCommand("ttl fooT");
  console.log(getResponse);
  const match = getResponse.match(/^:(\d+)\r\n$/);
  const ttlValue = parseInt(match[1]);

  // As timeout wont be exact 2 seconds
  assert.ok(ttlValue <= 3, "Expected ttlValue to be less than or equal to 3");

  const errorResponse = await sendCommand("ttl");
  assert.strictEqual(
    errorResponse,
    "-ERR wrong number of arguments for 'ttl' command\r\n"
  );
});

test("should INCR a key and error cases", async () => {
  await sendCommand("set fooI 5");

  const response1 = await sendCommand("incr fooI");
  assert.strictEqual(response1, ":6\r\n");

  const getResponse = await sendCommand("get fooI");
  assert.strictEqual(getResponse, "$1\r\n6\r\n");

  const response2 = await sendCommand("incr");
  assert.strictEqual(
    response2,
    "-ERR wrong number of arguments for 'incr' command\r\n"
  );

  await sendCommand("set fooInvali tada1");
  const errorResponse = await sendCommand("incr fooInvali");
  assert.strictEqual(
    errorResponse,
    "-ERR value is not an integer or out of range\r\n"
  );

  const response3 = await sendCommand("incr fooNewKey1");
  assert.strictEqual(response3, ":1\r\n");
});

test("should DECR a key and error cases", async () => {
  await sendCommand("set fooD 11");

  const response1 = await sendCommand("decr fooD");
  assert.strictEqual(response1, ":10\r\n");

  const getResponse = await sendCommand("get fooD");
  assert.strictEqual(getResponse, "$2\r\n10\r\n");

  const response2 = await sendCommand("decr");
  assert.strictEqual(
    response2,
    "-ERR wrong number of arguments for 'decr' command\r\n"
  );

  await sendCommand("set fooInvali tada2");
  const errorResponse = await sendCommand("decr fooInvali");
  assert.strictEqual(
    errorResponse,
    "-ERR value is not an integer or out of range\r\n"
  );

  const response3 = await sendCommand("decr fooNewKey2");
  assert.strictEqual(response3, ":-1\r\n");
});

test("should return error for LRANGE invalid key", async () => {
  const errorResponse1 = await sendCommand("lrange list1");
  assert.strictEqual(
    errorResponse1,
    "-ERR wrong number of arguments for 'lrange' command\r\n"
  );

  const errorResponse2 = await sendCommand("lrange list1 0 4");
  assert.strictEqual(errorResponse2, "$-1\r\n");
});

test("should LPUSH for a key, error cases and LRANGE", async () => {
  const lPushResponse = await sendCommand("lpush list1 el1");
  assert.strictEqual(lPushResponse, ":1\r\n");

  const lRangeResponse = await sendCommand("lrange list1 0 0");
  assert.strictEqual(lRangeResponse, "*1\r\n$3\r\nel1\r\n");

  const errorResponse1 = await sendCommand("lpush foo");
  assert.strictEqual(
    errorResponse1,
    "-ERR wrong number of arguments for 'lpush' command\r\n"
  );

  await sendCommand("set foo bar");
  const errorResponse2 = await sendCommand("lpush foo one");
  assert.strictEqual(errorResponse2, "-ERR wrong type of key\r\n");
});

test("should RPUSH for a key, error cases and LRANGE", async () => {
  const rPushResponse = await sendCommand("rpush list2 el");
  assert.strictEqual(rPushResponse, ":1\r\n");

  const lRangeResponse = await sendCommand("lrange list2 0 0");
  assert.strictEqual(lRangeResponse, "*1\r\n$2\r\nel\r\n");

  const errorResponse1 = await sendCommand("rpush list2");
  assert.strictEqual(
    errorResponse1,
    "-ERR wrong number of arguments for 'rpush' command\r\n"
  );

  await sendCommand("set foo bar");
  const errorResponse = await sendCommand("rpush foo one");
  assert.strictEqual(errorResponse, "-ERR wrong type of key\r\n");
});

test("should LPOP for a key, error cases and LRANGE", async () => {
  const lPopResponse1 = await sendCommand("lpop list3");
  assert.strictEqual(lPopResponse1, "$-1\r\n");

  await sendCommand("lpush list3 el1");
  await sendCommand("lpush list3 el2");

  const lRangeResponse = await sendCommand("lrange list3 0 1");
  assert.strictEqual(lRangeResponse, "*2\r\n$3\r\nel2\r\n$3\r\nel1\r\n");

  const lPopResponse2 = await sendCommand("lpop list3");
  assert.strictEqual(lPopResponse2, "$3\r\nel2\r\n");

  const errorResponse = await sendCommand("lpop");
  assert.strictEqual(
    errorResponse,
    "-ERR wrong number of arguments for 'lpop' command\r\n"
  );
});

test("should RPOP for a key, error cases and LRANGE", async () => {
  const rPopResponse1 = await sendCommand("rpop list4");
  assert.strictEqual(rPopResponse1, "$-1\r\n");

  await sendCommand("lpush list4 el1");
  await sendCommand("lpush list4 el2");

  const lRangeResponse = await sendCommand("lrange list4 0 1");
  assert.strictEqual(lRangeResponse, "*2\r\n$3\r\nel2\r\n$3\r\nel1\r\n");

  const lPopResponse2 = await sendCommand("rpop list4");
  assert.strictEqual(lPopResponse2, "$3\r\nel1\r\n");

  const errorResponse = await sendCommand("rpop");
  assert.strictEqual(
    errorResponse,
    "-ERR wrong number of arguments for 'rpop' command\r\n"
  );
});
