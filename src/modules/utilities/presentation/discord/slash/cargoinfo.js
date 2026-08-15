const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { LabelBuilder } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargo-info')
    .setDescription('「Utilidades」Veja as informações de um cargo específico')
    .addRoleOption((option) =>
      option
        .setName('cargo')
        .setDescription('Selecione o cargo que deseja ver as informações')
        .setRequired(true),
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('cargo');

    // Pega as permissões e formata em uma lista legível
    const permissions = role.permissions.toArray();
    const formattedPermissions = permissions.map(
      (perm) =>
        `• ${perm
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (l) => l.toUpperCase())}`,
    );

    // Limita o número de permissões mostradas
    const maxPermissions = 10;
    const displayedPermissions =
      formattedPermissions.slice(0, maxPermissions).join('\n') +
      (permissions.length > maxPermissions
        ? `\n...e mais ${permissions.length - maxPermissions} permissões`
        : '');

    const label = new LabelBuilder()
      .setTitle(`Informações do Cargo: ${role.name}`)
      .setColor(role.color || 0x2f3136)
      .addField('ID', role.id, true)
      .addField('Mencionável', role.mentionable ? 'Sim' : 'Não', true)
      .addField('Posição', `${role.position}`, true)
      .addField('Cor', role.hexColor, true)
      .addField('Quantidade de Membros', `${role.members.size} membro(s)`, true)
      .addField('Permissões', displayedPermissions || 'Nenhuma')
      .addField('Criado em', `<t:${Math.floor(role.createdTimestamp / 1000)}:f>`)
      .setFooter(`Solicitado por ${interaction.user.tag}`);

    await interaction.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
