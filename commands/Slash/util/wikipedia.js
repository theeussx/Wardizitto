const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require("discord.js");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("wikipedia")
        .setDescription("🔍 Pesquise por artigos na Wikipedia.")
        .addStringOption(option => 
            option.setName("busca")
                .setDescription("O que você deseja pesquisar?")
                .setRequired(true)),

    async execute(interaction) {
        const query = interaction.options.getString("busca");
        
        await interaction.deferReply();

        try {
            // API da Wikipedia (Resumo do artigo)
            const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, "_"))}`;
            
            const response = await axios.get(url);
            const data = response.data;

            if (data.type === "disambiguation") {
                return interaction.editReply({ content: `⚠️ O termo **${query}** é ambíguo. Tente ser mais específico.` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📖 Wikipedia: ${data.title}`)
                .setURL(data.content_urls.desktop.page)
                .setDescription(data.extract || "Nenhum resumo disponível para este artigo.")
                .setColor("#5865F2")
                .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/1200px-Wikipedia-logo-v2.svg.png")
                .setTimestamp();

            if (data.thumbnail) {
                embed.setImage(data.thumbnail.source);
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ler Artigo Completo")
                    .setURL(data.content_urls.desktop.page)
                    .setStyle(ButtonStyle.Link)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                return interaction.editReply({ content: `❌ Não encontrei nenhum artigo sobre **${query}** na Wikipedia.` });
            }
            
            console.error("Erro na pesquisa Wikipedia:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao tentar realizar a pesquisa." });
        }
    }
};
