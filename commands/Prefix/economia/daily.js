const { 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");
const ms = require("ms");

module.exports = {
    name: "daily",
    description: "Resgate sua recompensa diária de Wardcoins.",
    category: "economia",
    run: async (client, message, args) => {
        const userId = message.author.id;

        try {
            // Consulta o banco de dados
            const rows = await query("SELECT ultima_daily FROM economia_usuarios WHERE user_id = ?", [userId]);
            const data = rows[0]; // Pega o primeiro resultado do array
            const cooldown = 86400000; // 24 horas

            // --- VERIFICAÇÃO DE COOLDOWN ---
            if (data && data.ultima_daily) {
                const lastDaily = new Date(data.ultima_daily).getTime();
                if (Date.now() - lastDaily < cooldown) {
                    const remaining = cooldown - (Date.now() - lastDaily);
                    
                    const cooldownContainer = new ContainerBuilder()
                        .setAccentColor(0xED4245) // Vermelho
                        .addTextDisplayComponents(t => t.setContent(`### ⏰ Cooldown Ativo\n> Você já resgatou sua recompensa hoje!\n\n**Disponível em:** \`${ms(remaining, { long: true })}\``));

                    return message.reply({ 
                        components: [cooldownContainer], 
                        flags: [MessageFlags.IsComponentsV2] 
                    });
                }
            }

            // --- LÓGICA DE RECOMPENSA ---
            const reward = Math.floor(Math.random() * (5000 - 1500 + 1)) + 1500;

            await query(
                `INSERT INTO economia_usuarios (user_id, carteira, ultima_daily) 
                 VALUES (?, ?, CURRENT_TIMESTAMP) 
                 ON DUPLICATE KEY UPDATE 
                 carteira = carteira + ?, ultima_daily = CURRENT_TIMESTAMP`,
                [userId, reward, reward]
            );

            // --- DESIGN DO CONTAINER V2 ---
            const dailyContainer = new ContainerBuilder()
                .setAccentColor(0xF1C40F) // Amarelo Wardico
                .addTextDisplayComponents(t => t.setContent(`## 🪙 Recompensa Resgatada!\n> Sua constância foi recompensada com sucesso.`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `**Valor Recebido:** \`${reward.toLocaleString()}\` Wardcoins\n` +
                    `**Dica:** Volte amanhã para manter sua sequência!`
                ));

            // Botão único desativado (Futuro)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Visitar Site (Futuro)")
                    .setURL("https://wardizitto.app") // URL necessária para estilo Link, mesmo desativado
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true) // Deixa o botão indisponível
            );

            await message.reply({ 
                components: [dailyContainer, row], 
                flags: [MessageFlags.IsComponentsV2] 
            });

        } catch (error) {
            console.error("Erro no daily:", error);
            message.reply("❌ Ocorreu um erro técnico ao processar seu daily.");
        }
    }
};
