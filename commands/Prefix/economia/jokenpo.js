const { 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");
const { checkLevelUp } = require("../../../events/economia/LevelUpHandler.js");
const ms = require("ms");

module.exports = {
    name: "jokenpo",
    description: "Jogue Pedra, Papel ou Tesoura (Limite: 5 Bot / 7 Player por hora).",
    category: "economia",
    run: async (client, message, args) => {
        const aposta = parseInt(args[0]);
        const userId = message.author.id;

        if (isNaN(aposta) || aposta < 50) return message.reply("❌ Use: `!jokenpo <quantia>`");

        try {
            // 1. Busca dados e verifica Cooldown/Limites
            const rows = await query("SELECT carteira, jkp_bot_count, ultima_jkp_reset FROM economia_usuarios WHERE user_id = ?", [userId]);
            const user = rows[0];

            if (!user || user.carteira < aposta) return message.reply("❌ Saldo insuficiente!");

            // Lógica de Reset de 1 Hora
            const agora = Date.now();
            const tempoReset = new Date(user.ultima_jkp_reset).getTime() + 3600000;

            if (agora > tempoReset) {
                await query("UPDATE economia_usuarios SET jkp_bot_count = 0, jkp_player_count = 0, ultima_jkp_reset = CURRENT_TIMESTAMP WHERE user_id = ?", [userId]);
                user.jkp_bot_count = 0;
            }

            // Verificação de Limite contra o Bot (5 jogadas)
            if (user.jkp_bot_count >= 5) {
                const restante = tempoReset - agora;
                const limitContainer = new ContainerBuilder()
                    .setAccentColor(0xED4245)
                    .addTextDisplayComponents(t => t.setContent(`### 🛡️ Limite de Treino Atingido\n> Você já jogou **5 vezes** contra o bot nesta hora.\n\n**Disponível em:** \`${ms(restante, { long: true })}\``));
                return message.reply({ components: [limitContainer], flags: [MessageFlags.IsComponentsV2] });
            }

            
            const gameContainer = new ContainerBuilder()
                .setAccentColor(0x3498DB)
                .addTextDisplayComponents(t => t.setContent(`## 🎮 Jokenpô vs Bot\n> Aposta: **${aposta.toLocaleString()}** 🪙\n> Rodada: **${user.jkp_bot_count + 1}/5**`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Pedra** ✊"))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("jkp_pedra").setLabel("Escolher").setStyle(ButtonStyle.Secondary))
                )
                .addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Papel** ✋"))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("jkp_papel").setLabel("Escolher").setStyle(ButtonStyle.Secondary))
                )
                .addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Tesoura** ✌️"))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("jkp_tesoura").setLabel("Escolher").setStyle(ButtonStyle.Secondary))
                );

            const msg = await message.reply({ components: [gameContainer], flags: [MessageFlags.IsComponentsV2] });

            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000,
                max: 1
            });

            collector.on("collect", async (i) => {
                const escolhas = ["pedra", "papel", "tesoura"];
                const botEscolha = escolhas[Math.floor(Math.random() * escolhas.length)];
                const userEscolha = i.customId.replace("jkp_", "");
                const emojis = { pedra: "✊", papel: "✋", tesoura: "✌️" };

                let resultado; // 0: Empate, 1: Vitória, 2: Derrota
                if (userEscolha === botEscolha) resultado = 0;
                else if (
                    (userEscolha === "pedra" && botEscolha === "tesoura") ||
                    (userEscolha === "papel" && botEscolha === "pedra") ||
                    (userEscolha === "tesoura" && botEscolha === "papel")
                ) resultado = 1;
                else resultado = 2;

                // Atualiza Banco (Saldo + Contador)
                if (resultado === 1) {
                    await query("UPDATE economia_usuarios SET carteira = carteira + ?, jkp_bot_count = jkp_bot_count + 1 WHERE user_id = ?", [aposta, userId]);
                    await checkLevelUp(userId, message);
                } else if (resultado === 2) {
                    await query("UPDATE economia_usuarios SET carteira = carteira - ?, jkp_bot_count = jkp_bot_count + 1 WHERE user_id = ?", [aposta, userId]);
                } else {
                    await query("UPDATE economia_usuarios SET jkp_bot_count = jkp_bot_count + 1 WHERE user_id = ?", [userId]);
                }

                // --- TELA DE RESULTADO ---
                const resContainer = new ContainerBuilder().setAccentColor(resultado === 1 ? 0x2ECC71 : (resultado === 2 ? 0xE74C3C : 0x95A5A6));
                
                const statusTxt = resultado === 1 ? "🎉 Vitória!" : (resultado === 2 ? "😢 Derrota..." : "🤝 Empate!");
                
                resContainer.addTextDisplayComponents(t => t.setContent(`### ${statusTxt}\n> Você usou **${userEscolha}** e o bot **${botEscolha}**.`))
                            .addSeparatorComponents(new SeparatorBuilder())
                            .addTextDisplayComponents(t => t.setContent(`📊 **Estatísticas da Hora:** ${user.jkp_bot_count + 1}/5 jogadas.`));

                await i.update({ components: [resContainer] });
            });

        } catch (error) {
            console.error(error);
            message.reply("❌ Erro ao processar duelo.");
        }
    }
};
