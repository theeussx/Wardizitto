const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");
const ms = require("ms");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Resgate sua recompensa diária de Wardcoins."),

    async execute(interaction) {
        const userId = interaction.user.id;
        await interaction.deferReply();

        try {
            const data = (await query("SELECT ultima_daily FROM economia_usuarios WHERE user_id = ?", [userId]))[0];
            const cooldown = 86400000; // 24 horas

            if (data && data.ultima_daily) {
                const lastDaily = new Date(data.ultima_daily).getTime();
                if (Date.now() - lastDaily < cooldown) {
                    const remaining = cooldown - (Date.now() - lastDaily);
                    const embedCooldown = new EmbedBuilder()
                        .setTitle("<:icons_clock:1353597227146412094> Cooldown Ativo")
                        .setDescription(`Você já resgatou seu daily hoje! Tente novamente em **${ms(remaining, { long: true })}**.`)
                        .setColor("#E74C3C")
                        .setTimestamp();
                    
                    return interaction.editReply({ embeds: [embedCooldown] });
                }
            }

            const reward = Math.floor(Math.random() * (5000 - 1500 + 1)) + 1500;

            await query(
                `INSERT INTO economia_usuarios (user_id, carteira, ultima_daily) 
                 VALUES (?, ?, CURRENT_TIMESTAMP) 
                 ON DUPLICATE KEY UPDATE 
                 carteira = carteira + ?, ultima_daily = CURRENT_TIMESTAMP`,
                [userId, reward, reward]
            );

            const embed = new EmbedBuilder()
                .setTitle("<:icons_coin:1353597230195408917> Recompensa Diária")
                .setDescription(`Você resgatou suas Wardcoins diárias e ganhou **${reward.toLocaleString()}** 🪙!`)
                .setColor("#F1C40F")
                .addFields({ name: "💡 Dica", value: "Em breve você poderá resgatar bônus exclusivos pelo nosso site oficial!" })
                .setFooter({ text: "Wardizitto Economy", iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Visitar Site (Em Breve)")
                    .setURL("https://wardizitto.app") // Exemplo de URL futura
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error("Erro no daily:", error);
            await interaction.editReply("❌ Ocorreu um erro ao processar seu daily.");
        }
    }
};
