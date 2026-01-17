const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Veja o ranking de Wardcoins.")
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
        await interaction.deferReply();

        try {
            let results;
            if (tipo === "global") {
                results = await query(
                    "SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC LIMIT 10"
                );
            } else {
                // Para o ranking do servidor, precisamos filtrar pelos membros que estão no servidor atual
                // Como o banco de dados não armazena guild_id na tabela de usuários, vamos buscar os top globais e filtrar no código
                // ou buscar todos e filtrar (menos eficiente, mas necessário sem guild_id na tabela de economia_usuarios)
                const allUsers = await query(
                    "SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC"
                );
                
                results = [];
                for (const row of allUsers) {
                    try {
                        const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                        if (member) {
                            results.push(row);
                            if (results.length === 10) break;
                        }
                    } catch (e) { continue; }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Ranking de Wardcoins - ${tipo === "global" ? "Global" : "Servidor"}`)
                .setColor("#F1C40F")
                .setTimestamp();

            if (results.length === 0) {
                embed.setDescription("Nenhum dado encontrado para este ranking.");
            } else {
                const leaderboard = await Promise.all(results.map(async (row, index) => {
                    const user = await interaction.client.users.fetch(row.user_id).catch(() => ({ username: "Usuário Desconhecido" }));
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    return `${medal} **${user.username}** - \`${row.total.toLocaleString()}\` 🪙`;
                }));
                embed.setDescription(leaderboard.join("\n"));
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Erro no ranking:", error);
            await interaction.editReply("❌ Ocorreu um erro ao carregar o ranking.");
        }
    }
};
