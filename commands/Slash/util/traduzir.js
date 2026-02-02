const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("traduzir")
        .setDescription("🌐 Traduz um texto para outro idioma.")
        .addStringOption(opt => opt.setName("texto").setDescription("O texto que você deseja traduzir.").setRequired(true))
        .addStringOption(opt => opt.setName("idioma").setDescription("O idioma de destino (ex: en, es, fr, ja).").setRequired(true)),

    async execute(interaction) {
        const texto = interaction.options.getString("texto");
        const idioma = interaction.options.getString("idioma");

        await interaction.deferReply();

        try {
            // Simulação de tradução (em um ambiente real, você usaria uma API como Google Translate ou LibreTranslate)
            // Aqui apenas demonstramos a estrutura do comando complexo
            const embed = new EmbedBuilder()
                .setTitle("🌐 Tradução Wardizitto")
                .addFields(
                    { name: "📥 Original", value: `\`\`\`${texto}\`\`\`` },
                    { name: `📤 Traduzido (${idioma.toUpperCase()})`, value: `\`\`\`[Tradução simulada para ${idioma}]\`\`\`` }
                )
                .setFooter({ text: "Dica: Use códigos de 2 letras como 'en' para Inglês." })
                .setColor("#5865F2");

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: "❌ Ocorreu um erro ao tentar traduzir o texto." });
        }
    }
};
