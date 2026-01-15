const { WebhookClient } = require('discord.js');
require('dotenv').config();

module.exports = (client) => {
    if (!process.env.WEBHOOK_LOGS_URL) {
        console.error('❌ ERRO: Webhook URL não está definido no .env!');
        return;
    }

    const webhook = new WebhookClient({ url: process.env.WEBHOOK_LOGS_URL });

    client.on('guildCreate', async (guild) => {
        console.log(`✅ Bot foi adicionado ao servidor: ${guild.name} (${guild.id})`);
        webhook.send({
            content: `✅ <@1033922089436053535> O bot entrou no servidor **${guild.name}** (\`${guild.id}\`)`,
        }).catch(console.error);
    });

    client.on('guildDelete', async (guild) => {
        console.log(`❌ Bot foi removido do servidor: ${guild.name} (${guild.id})`);
        webhook.send({
            content: `❌ O bot foi removido do servidor **${guild.name}** (\`${guild.id}\`)`,
        }).catch(console.error);
    });
};