const { MessageFlags } = require('discord.js');
const { LabelBuilder } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  async execute(interaction) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('github_select_')) {
      return;
    }
    const username = interaction.customId.slice('github_select_'.length);
    const repositoryName = interaction.values[0];
    if (
      !/^[A-Za-z0-9-]{1,39}$/.test(username) ||
      !repositoryName ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(repositoryName)
    ) {
      return interaction.reply({
        content: '❌ Seleção de repositório inválida.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repositoryName)}`,
      {
        headers: { 'user-agent': 'Wardizitto/2.0' },
        signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}.`);
    const repository = await response.json();
    const label = new LabelBuilder()
      .setTitle(String(repository.full_name).slice(0, 256))
      .setURL(repository.html_url)
      .setDescription(String(repository.description || 'Sem descrição.').slice(0, 2000))
      .addField('Linguagem', String(repository.language || 'N/A'), true)
      .addField('Estrelas', String(repository.stargazers_count), true)
      .addField('Forks', String(repository.forks_count), true)
      .addField('Issues abertas', String(repository.open_issues_count), true)
      .addField('Licença', String(repository.license?.name || 'Nenhuma'), true)
      .setColor(0x2f81f7);
    await interaction.update({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
