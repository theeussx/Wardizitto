const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "ajuda",
    description: "Lista todos os comandos de prefixo disponíveis.",
    run: async (client, message, args) => {
        const embed = new EmbedBuilder()
            .setTitle("📚 Comandos de Prefixo")
            .setDescription("Aqui estão os comandos que você pode usar com o prefixo!")
            .setColor("#5865F2")
            .setTimestamp();

        const commands = client.prefixCommands.map(cmd => `\`${cmd.name}\``).join(", ");
        embed.addFields({ name: "Lista de Comandos", value: commands || "Nenhum comando carregado." });

        message.reply({ embeds: [embed] });
    }
};
