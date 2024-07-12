const buildRedisCommand = (input) => {
  const args = input.split(" ");
  let command = `*${args.length}\r\n`;

  args.forEach((arg) => {
    command += `$${arg.length}\r\n${arg}\r\n`;
  });

  return command;
};

module.exports = {
  buildRedisCommand,
};
