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
                    { label: "Economia", value: "economia", emoji: "💰", description: "Ganhe Wardcoins e suba de nível." },
                    { label: "Utilidades", value: "util", emoji: "🛠️", description: "Ferramentas úteis para o dia a dia." },
                    { label: "Diversão", value: "diversao", emoji: "🎮", description: "Jogos e interações sociais." },
                    { label: "Moderação", value: "moderacao", emoji: "🔨", description: "Comandos de moderação." },
                    { label: "Social", value: "social", emoji: "👥", description: "Interações sociais." },
                    { label: "Dono", value: "dono", emoji: "👑", description: "Comandos exclusivos do dono." }
                ])
        );

        const msg = await message.reply({ embeds: [embed], components: [menu] });

        const filter = i => i.customId === "help_menu" && i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async i => {
            const category = i.values[0];
            let categoryName = "";
            let emoji = "";

            const categoryMap = {
                admin: { name: "🛡️ Administração", emoji: "🛡️" },
                economia: { name: "💰 Economia", emoji: "💰" },
                util: { name: "🛠️ Utilidades", emoji: "🛠️" },
                diversao: { name: "🎮 Diversão", emoji: "🎮" },
                moderacao: { name: "🔨 Moderação", emoji: "🔨" },
                social: { name: "👥 Social", emoji: "👥" },
                dono: { name: "👑 Dono", emoji: "👑" }
            };

            if (categoryMap[category]) {
                categoryName = categoryMap[category].name;
                emoji = categoryMap[category].emoji;
            } else {
                categoryName = "Categoria Desconhecida";
            }

            const prefixCmds = client.prefixCommands.filter(cmd => cmd.category === category).map(cmd => `\`${cmd.name}\``).join(', ') || 'Nenhum';
            const slashCmds = client.commands.filter(cmd => cmd.category === category).map(cmd => `\`/${cmd.data.name}\``).join(', ') || 'Nenhum';

            const newEmbed = new EmbedBuilder()
                .setTitle(categoryName)
                .setDescription(`**Comandos de Prefixo:**\n${prefixCmds}\n\n**Comandos Slash:**\n${slashCmds}`)
                .setColor("#5865F2")
                .setTimestamp();

            await i.update({ embeds: [newEmbed] });
        });
    }
};
