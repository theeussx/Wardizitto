module.exports = {
  name: 'ping',
  description: 'Verifica a latência do bot.',
  run: async (client, message, args) => {
    const msg = await message.reply('🏓 Calculando...');
    const latency = msg.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    msg.edit(`🏓 **Pong!**\nLatência: \`${latency}ms\`\nAPI: \`${apiLatency}ms\``);
  },
};
