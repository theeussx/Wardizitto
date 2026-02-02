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
    name: "apostar",
    description: "Aposte Wardcoins (Limite: 5 por hora).",
    category: "economia",
    run: async (client, message, args) => {
        const userId = message.author.id;
        const quantia = parseInt(args[0]);
        const escolha = args[1]?.toLowerCase();

        // Validações Iniciais
        if (isNaN(quantia) || quantia < 100) return message.reply("❌ Aposte pelo menos **100** Wardcoins!");
        if (!["cara", "coroa"].includes(escolha)) return message.reply("❌ Escolha entre `cara` ou `coroa`.");

        try {
            // Busca dados do usuário (Economia + Limite)
            const rows = await query("SELECT carteira, apostas_count, ultima_aposta_reset FROM economia_usuarios WHERE user_id = ?", [userId]);
            const user = rows[0];

            if (!user || user.carteira < quantia) return message.reply("❌ Você não tem saldo suficiente!");

            // --- LÓGICA DE LIMITE (5 por HORA) ---
            const agora = Date.now();
            const tempoReset = new Date(user.ultima_aposta_reset).getTime() + 3600000; // +1 hora

            let contagemAtual = user.apostas_count;

            if (agora > tempoReset) {
                // Se passou 1 hora, reseta o contador
                contagemAtual = 0;
                await query("UPDATE economia_usuarios SET apostas_count = 0, ultima_aposta_reset = CURRENT_TIMESTAMP WHERE user_id = ?", [userId]);
            }

            if (contagemAtual >= 5) {
                const restante = tempoReset - agora;
                const limitContainer = new ContainerBuilder()
                    .setAccentColor(0xED4245)
                    .addTextDisplayComponents(t => t.setContent(`### 🛡️ Limite Atingido\n> Você já fez **5 apostas** nesta hora.\n\n**Tente novamente em:** \`${ms(restante, { long: true })}\``));
                
                return message.reply({ components: [limitContainer], flags: [MessageFlags.IsComponentsV2] });
            }

            // --- INICIANDO O SORTEIO ---
            const resultado = Math.random() < 0.5 ? "cara" : "coroa";
            const ganhou = (escolha === resultado);

            // Interface de Suspense
            const loading = new ContainerBuilder()
                .setAccentColor(0x2F3136)
                .addTextDisplayComponents(t => t.setContent(`### 🪙 A moeda está no ar...\n> Sua aposta de **${quantia}** em **${escolha.toUpperCase()}** está sendo processada!`));

            const msg = await message.reply({ components: [loading], flags: [MessageFlags.IsComponentsV2] });

            // Incrementa o contador de apostas
            await query("UPDATE economia_usuarios SET apostas_count = apostas_count + 1 WHERE user_id = ?", [userId]);

            // Delay para o resultado (2 segundos)
            setTimeout(async () => {
                const resContainer = new ContainerBuilder().setAccentColor(ganhou ? 0x2ECC71 : 0xED4245);

                if (ganhou) {
                    await query("UPDATE economia_usuarios SET carteira = carteira + ? WHERE user_id = ?", [quantia, userId]);
                    resContainer.addTextDisplayComponents(t => t.setContent(
                        `## 🎉 VITÓRIA!\n> Caiu **${resultado.toUpperCase()}**! Você ganhou **${quantia.toLocaleString()}** 🪙.\n\n*Apostas nesta hora: ${contagemAtual + 1}/5*`
                    ));
                } else {
                    await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [quantia, userId]);
                    resContainer.addTextDisplayComponents(t => t.setContent(
                        `## 💀 DERROTA...\n> Caiu **${resultado.toUpperCase()}**. Você perdeu sua aposta.\n\n*Apostas nesta hora: ${contagemAtual + 1}/5*`
                    ));
                }

                await msg.edit({ components: [resContainer] });
            }, 2000);

        } catch (error) {
            console.error("Erro no sistema de apostas:", error);
            message.reply("❌ Erro técnico ao processar aposta.");
        }
    }
};
