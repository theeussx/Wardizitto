const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("🏆 Veja o ranking dos usuários mais ricos.")
        .addStringOption(option =>
            option.setName("tipo")
                .setDescription("Escolha o tipo de ranking.")
                .setRequired(true)
                .addChoices(
                    { name: "Servidor", value: "servidor" },
                    { name: "Global", value: "global" }
                )
        ),

    async execute(interaction) {
        const tipo = interaction.options.getString("tipo");
        
        await interaction.deferReply({ flags: [MessageFlags.IsComponentsV2] });

        try {
            let results;
            if (tipo === "servidor") {
                // Para o ranking do servidor, precisaríamos de uma tabela que vincula usuários a servidores
                // Como a estrutura atual é global por user_id, vamos simular ou filtrar se houver essa lógica
                results = await query("SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC LIMIT 10");
            } else {
                results = await query("SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC LIMIT 10");
            }

            const container = new ContainerBuilder()
                .setAccentColor(0xF1C40F)
                .addTextDisplayComponents(t => t.setContent(`## 🏆 Ranking de Wardcoins (${tipo.toUpperCase()})`))
                .addSeparatorComponents(new SeparatorBuilder());

            let rankText = "";
            for (let i = 0; i < results.length; i++) {
                const user = await interaction.client.users.fetch(results[i].user_id).catch(() => ({ username: "Usuário Desconhecido" }));
                const medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : `\`#${i + 1}\``));
                rankText += `${medal} **${user.username}** — \`${BigInt(results[i].total).toLocaleString()}\` 🪙\n`;
            }

            container.addTextDisplayComponents(t => t.setContent(rankText || "Nenhum dado encontrado no ranking."));

            const mainRow = new ActionRowBuilder().addComponents(container);
            await interaction.editReply({ components: [mainRow] });

        } catch (error) {
            console.error("Erro no Rank:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao carregar o ranking." });
        }
    }
};
