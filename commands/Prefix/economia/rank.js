const { 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    name: "rank",
    description: "Veja o ranking de Wardcoins (Global ou Servidor).",
    category: "economia",
    run: async (client, message, args) => {
        // Define o tipo com base no argumento ou padrão para Servidor
        const tipo = args[0]?.toLowerCase() === "global" ? "global" : "servidor";

        try {
            let results;
            if (tipo === "global") {
                results = await query(
                    "SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC LIMIT 10"
                );
            } else {
                // Busca todos e filtra pelos membros presentes no servidor
                const allUsers = await query(
                    "SELECT user_id, (carteira + banco) as total FROM economia_usuarios ORDER BY total DESC"
                );
                
                results = [];
                for (const row of allUsers) {
                    const member = message.guild.members.cache.get(row.user_id);
                    if (member) {
                        results.push(row);
                        if (results.length === 10) break;
                    }
                }
            }

            // --- DESIGN DO RANKING V2 ---
            const rankContainer = new ContainerBuilder()
                .setAccentColor(0xF1C40F) // Amarelo Ouro
                .addTextDisplayComponents(t => t.setContent(`## 🏆 Ranking ${tipo === "global" ? "Global" : "do Servidor"}\n> Os maiores acumuladores de Wardcoins do ecossistema.`))
                .addSeparatorComponents(new SeparatorBuilder());

            if (results.length === 0) {
                rankContainer.addTextDisplayComponents(t => t.setContent("_Nenhum dado financeiro registrado neste setor._"));
            } else {
                const leaderboard = await Promise.all(results.map(async (row, index) => {
                    const user = await client.users.fetch(row.user_id).catch(() => ({ username: "Desconhecido" }));
                    
                    // Ícones de medalha para o Top 3
                    let medal = `**#${index + 1}**`;
                    if (index === 0) medal = "🥇";
                    if (index === 1) medal = "🥈";
                    if (index === 2) medal = "🥉";

                    return `${medal} **${user.username}** — \`${row.total.toLocaleString()}\` 🪙`;
                }));

                // Adiciona o Top 3 com destaque
                rankContainer.addTextDisplayComponents(t => t.setContent(leaderboard.slice(0, 3).join("\n")));
                
                // Adiciona uma linha divisória se houver mais de 3 jogadores
                if (leaderboard.length > 3) {
                    rankContainer.addSeparatorComponents(new SeparatorBuilder());
                    rankContainer.addTextDisplayComponents(t => t.setContent(leaderboard.slice(3).join("\n")));
                }
            }

            // Botão de Site (Futuro) desativado como solicitado
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ver Ranking Completo (Futuro)")
                    .setURL("https://wardizitto.app")
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true)
            );

            await message.reply({ 
                components: [rankContainer, row], 
                flags: [MessageFlags.IsComponentsV2] 
            });

        } catch (error) {
            console.error("Erro no ranking:", error);
            message.reply("❌ Falha ao processar o banco de dados do ranking.");
        }
    }
};
