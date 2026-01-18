const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
    name: "ajuda",
    description: "Central de ajuda do Wardizitto.",
    run: async (client, message, args) => {
        const embed = new EmbedBuilder()
            .setTitle("📚 Central de Comandos - Wardizitto")
            .setDescription("Olá! Eu sou o **Wardizitto**, seu bot de administração e economia. Use o menu abaixo para explorar minhas funcionalidades!")
            .addFields(
                { name: "✨ Comandos de Prefixo", value: `Atualmente possuo **${client.prefixCommands.size}** comandos de prefixo.`, inline: true },
                { name: "🚀 Comandos Slash", value: `Atualmente possuo **${client.commands.size}** comandos slash.`, inline: true }
            )
            .setColor("#5865F2")
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Solicitado por ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help_menu")
                .setPlaceholder("Escolha uma categoria...")
                .addOptions([
                    { label: "Administração", value: "admin", emoji: "🛡️", description: "Comandos para gerenciar o servidor." },
                    { label: "Economia", value: "economy", emoji: "💰", description: "Ganhe Wardcoins e suba de nível." },
                    { label: "Utilidades", value: "util", emoji: "🛠️", description: "Ferramentas úteis para o dia a dia." },
                    { label: "Diversão", value: "fun", emoji: "🎮", description: "Jogos e interações sociais." }
                ])
        );

        const msg = await message.reply({ embeds: [embed], components: [menu] });

        const filter = i => i.customId === "help_menu" && i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async i => {
            const category = i.values[0];
            let categoryName = "";
            let commandsList = "";

            if (category === "admin") {
                categoryName = "🛡️ Administração";
                commandsList = "prefix: `clear`, `lock`, `unlock`\nslash: `setup-tickets`, `cargo`";
            } else if (category === "economy") {
                categoryName = "💰 Economia";
                commandsList = "prefix: `saldo`\nslash: `perfil`, `daily`, `trabalhar`, `apostar`, `rank`";
            } else if (category === "util") {
                categoryName = "🛠️ Utilidades";
                commandsList = "prefix: `ajuda`, `ping`, `userinfo`, `serverinfo`, `avatar`";
            } else if (category === "fun") {
                categoryName = "🎮 Diversão";
                commandsList = "slash: `jokenpo`, `ship`, `abraço`, `beijo`";
            }

            const newEmbed = new EmbedBuilder()
                .setTitle(categoryName)
                .setDescription(`Aqui estão os comandos desta categoria:\n\n${commandsList}`)
                .setColor("#5865F2")
                .setTimestamp();

            await i.update({ embeds: [newEmbed] });
        });
    }
};
