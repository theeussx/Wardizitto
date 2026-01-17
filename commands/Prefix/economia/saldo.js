const { EmbedBuilder } = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    name: "saldo",
    description: "Veja o seu saldo de Wardcoins.",
    run: async (client, message, args) => {
        const target = message.mentions.users.first() || message.author;
        
        try {
            const userData = (await query("SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?", [target.id]))[0];

            if (!userData) {
                return message.reply("❌ Este usuário ainda não possui uma conta na economia.");
            }

            const embed = new EmbedBuilder()
                .setTitle(`💰 Saldo de ${target.username}`)
                .addFields(
                    { name: "Carteira", value: `\`${userData.carteira.toLocaleString()}\` 🪙`, inline: true },
                    { name: "Banco", value: `\`${userData.banco.toLocaleString()}\` 🪙`, inline: true },
                    { name: "Total", value: `\`${(userData.carteira + userData.banco).toLocaleString()}\` 🪙`, inline: true }
                )
                .setColor("#F1C40F")
                .setTimestamp();

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao consultar o saldo.");
        }
    }
};
