const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "avatar",
    description: "Mostra o avatar de um usuário.",
    run: async (client, message, args) => {
        const user = message.mentions.users.first() || message.author;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setImage(avatarURL)
            .setColor("#5865F2")
            .setFooter({ text: `Requisitado por ${message.author.username}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Link do Avatar")
                .setURL(avatarURL)
                .setStyle(ButtonStyle.Link)
        );

        message.reply({ embeds: [embed], components: [row] });
    }
};
