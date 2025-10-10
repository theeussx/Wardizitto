const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('🇧🇷 Veja um meme brasileiro de uma categoria')
    .addStringOption(option =>
      option.setName('categoria')
        .setDescription('Escolha o tipo de meme brasileiro')
        .setRequired(true)
        .addChoices(
          { name: 'Memes BR 🇧🇷', value: 'memesbr' },
          { name: 'Boteco BR 🍻', value: 'botecodoreddit' },
          { name: 'Copypasta BR 📄', value: 'BrazilianCopypasta' },
          { name: 'Memes & Notícias 🗞️', value: 'memesenoticias' }
        )
    ),

  async execute(interaction) {
    const categoria = interaction.options.getString('categoria');

    await interaction.deferReply();

    try {
      const res = await fetch(`https://meme-api.com/gimme/${categoria}`);
      const meme = await res.json();

      if (!meme || !meme.url || meme.nsfw) {
        return interaction.editReply({
          content: '⚠️ Não consegui carregar esse meme. Tente outra categoria.'
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setURL(meme.postLink)
        .setImage(meme.url)
        .setColor('#00C8FF')
        .setFooter({ text: `📬 r/${meme.subreddit} • 👍 ${meme.ups} votos` });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Erro ao buscar meme brasileiro:', err);
      await interaction.editReply('❌ Ocorreu um erro ao buscar o meme.');
    }
  }
};