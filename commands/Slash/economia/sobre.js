const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sobre")
        .setDescription("Personalize a descrição do seu perfil.")
        .addStringOption(option => 
            option.setName("texto")
                .setDescription("A nova descrição para o seu perfil (máx. 255 caracteres).")
                .setRequired(true)
                .setMaxLength(255)
        ),

    async execute(interaction) {
        const texto = interaction.options.getString("texto");
        const userId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            await query(
                "INSERT INTO economia_usuarios (user_id, sobre_mim) VALUES (?, ?) ON DUPLICATE KEY UPDATE sobre_mim = ?",
                [userId, texto, texto]
            );

            const embed = new EmbedBuilder()
                .setTitle("✅ Perfil Atualizado")
                .setDescription(`Sua nova descrição foi definida para:\n\n*${texto}*`)
                .setColor("#2ECC71")
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao atualizar sobre_mim:", error);
            await interaction.editReply("❌ Ocorreu um erro ao atualizar sua descrição.");
        }
    }
};