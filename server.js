const net = require("net");

const logger = require("./logger")("server");

const server = net.createServer();
const port = 6379;
const host = "127.0.0.1";

server.on("connection", (socket) => {
  socket.on("data", (data) => {
    const reqData = data.toString();
    logger.log(reqData);

    socket.write("+OK\r\n");
    // socket.write("res: " + reqData);
  });

  socket.on("end", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, host, () => {
  logger.log(`Server running at ${host}:${port}`);
});
