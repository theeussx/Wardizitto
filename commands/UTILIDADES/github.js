const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('github-usuario')
    .setDescription('「Utilidades」Veja o perfil de um usuário do GitHub e explore seus repositórios')
    .addStringOption(option =>
      option.setName('usuario')
        .setDescription('Nome do usuário no GitHub')
        .setRequired(true)
    ),

  async execute(interaction) {
    const username = interaction.options.getString('usuario');
    const userUrl = `https://api.github.com/users/${username}`;
    const reposUrl = `https://api.github.com/users/${username}/repos?per_page=25&sort=updated`;

    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(userUrl),
        fetch(reposUrl)
      ]);

      if (!userRes.ok) {
        return interaction.reply({
          content: '<:icons_wrong:1353597190920212573> Usuário não encontrado!',
          ephemeral: true
        });
      }

      const user = await userRes.json();
      const repos = await reposRes.json();

      const embed = new EmbedBuilder()
        .setTitle(`<:icons_github:1353597535188553728> ${user.name || user.login}`)
        .setURL(user.html_url)
        .setDescription(`${user.bio || 'Sem bio'}\n[Ver perfil no GitHub](${user.html_url})`)
        .setThumbnail(user.avatar_url)
        .addFields(
          {
            name: '<:icons_folder:1353597430951841865> Repositórios Públicos',
            value: `${user.public_repos}`,
            inline: true
          },
          {
            name: '<:icons_people:1353597337766854690> Seguidores',
            value: `${user.followers}`,
            inline: true
          },
          {
            name: '<:icons_friends:1353597533602975809> Seguindo',
            value: `${user.following}`,
            inline: true
          }
        )
        .setColor(0x24292e)
        .setFooter({ text: `ID GitHub: ${user.id}` });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`github_select_${username}`)
        .setPlaceholder('Selecione um repositório')
        .addOptions(
          repos.map(repo => ({
            label: repo.name.slice(0, 100),
            value: repo.name,
            emoji: '📁'
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error(error);
      interaction.reply({
        content: '<:icons_warning:1353597798662148117> Erro ao buscar dados no GitHub.',
        ephemeral: true
      });
    }
  }
};