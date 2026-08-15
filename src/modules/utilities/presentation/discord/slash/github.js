const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('github-usuario')
    .setDescription('Veja um perfil do GitHub e seus repositórios.')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Nome do usuário no GitHub.')
        .setMinLength(1)
        .setMaxLength(39)
        .setRequired(true),
    ),

  async execute(interaction) {
    const username = interaction.options.getString('usuario', true).trim();
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)) {
      return interaction.reply({
        content: '❌ Nome de usuário do GitHub inválido.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply();
    const options = {
      headers: { 'user-agent': 'Wardizitto/2.0' },
      signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
    };
    const [userResponse, repositoriesResponse] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, options),
      fetch(`https://api.github.com/users/${username}/repos?per_page=25&sort=updated`, options),
    ]);
    if (userResponse.status === 404) return interaction.editReply('❌ Usuário não encontrado.');
    if (!userResponse.ok || !repositoriesResponse.ok) {
      throw new Error(
        `GitHub API indisponível (${userResponse.status}/${repositoriesResponse.status}).`,
      );
    }
    const user = await userResponse.json();
    const repositories = await repositoriesResponse.json();
    const embed = new EmbedBuilder()
      .setTitle(`GitHub · ${String(user.name || user.login).slice(0, 200)}`)
      .setURL(user.html_url)
      .setDescription(String(user.bio || 'Sem biografia.').slice(0, 1000))
      .setThumbnail(user.avatar_url)
      .addFields(
        { name: 'Repositórios', value: String(user.public_repos), inline: true },
        { name: 'Seguidores', value: String(user.followers), inline: true },
        { name: 'Seguindo', value: String(user.following), inline: true },
      )
      .setColor(0x24292e);
    if (Array.isArray(repositories) && repositories.length > 0) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`github_select_${username}`)
        .setPlaceholder('Selecione um repositório')
        .addOptions(
          repositories.slice(0, 25).map((repository) => ({
            label: String(repository.name).slice(0, 100),
            value: String(repository.name).slice(0, 100),
            emoji: '📁',
          })),
        );
      return interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
      });
    }
    return interaction.editReply({ embeds: [embed] });
  },
};
