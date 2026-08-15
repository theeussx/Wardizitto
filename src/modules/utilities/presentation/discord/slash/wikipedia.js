const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { LabelBuilder } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wikipedia')
    .setDescription('Pesquisa um termo na Wikipédia em português.')
    .addStringOption((option) =>
      option
        .setName('busca')
        .setDescription('Termo de busca.')
        .setMinLength(2)
        .setMaxLength(100)
        .setRequired(true),
    ),

  async execute(interaction) {
    const search = interaction.options.getString('busca', true).trim();
    await interaction.deferReply();
    const endpoint = new URL('https://pt.wikipedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: search,
      gsrnamespace: '0',
      gsrlimit: '1',
      prop: 'extracts|info',
      exintro: '1',
      explaintext: '1',
      exsentences: '5',
      inprop: 'url',
      format: 'json',
      origin: '*',
    }).toString();
    const response = await fetch(endpoint, {
      headers: { 'user-agent': 'Wardizitto/2.0 (Discord bot)' },
      signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Wikipedia respondeu HTTP ${response.status}.`);
    const payload = await response.json();
    const page = Object.values(payload.query?.pages || {})[0];
    if (!page) {
      return interaction.editReply({
        content: `Nenhum artigo encontrado para **${search}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const label = new LabelBuilder()
      .setColor('#f5f5f5')
      .setTitle(page.title)
      .setURL(page.fullurl)
      .setDescription((page.extract || 'Sem resumo disponível.').slice(0, 4000))
      .setFooter('Fonte: Wikipédia');
    return interaction.editReply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
