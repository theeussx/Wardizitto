const { MessageFlags, ContainerBuilder } = require('discord.js');

module.exports = {
  name: 'clear',
  description: '🧹 Limpa mensagens do canal.',
  run: async (client, message, args) => {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('❌ Você não tem permissão para usar este comando.');
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('❌ Informe uma quantia entre **1 e 100**.');
    }

    try {
      await message.channel.bulkDelete(amount + 1, true);

      const container = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents((t) =>
          t.setContent(`✅ Limpei **${amount}** mensagens com sucesso!`),
        );

      const msg = await message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
      setTimeout(() => msg.delete().catch(() => null), 5000);
    } catch (error) {
      message.client.services.logger.error('Erro em handler de compatibilidade.', error);
      message.reply('❌ Ocorreu um erro ao tentar limpar as mensagens.');
    }
  },
};
