const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargo-info')
    .setDescription('「Utilidades」Veja as informações de um cargo específico')
    .addRoleOption(option =>
      option.setName('cargo')
        .setDescription('Selecione o cargo que deseja ver as informações')
        .setRequired(true)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('cargo');

    // Pega as permissões e formata em uma lista legível
    const permissions = role.permissions.toArray();
    const formattedPermissions = permissions
      .map(perm => `• ${perm.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}`);

    // Limita o número de permissões mostradas
    const maxPermissions = 10;
    const displayedPermissions = formattedPermissions.slice(0, maxPermissions).join('\n') + 
      (permissions.length > maxPermissions ? `\n...e mais ${permissions.length - maxPermissions} permissões` : '');

    const embed = new EmbedBuilder()
      .setTitle(`Informações do Cargo: ${role.name}`)
      .setColor(role.color || 0x2f3136)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Mencionável', value: role.mentionable ? 'Sim' : 'Não', inline: true },
        { name: 'Posição', value: `${role.position}`, inline: true },
        { name: 'Cor', value: role.hexColor, inline: true },
        { name: 'Quantidade de Membros', value: `${role.members.size} membro(s)`, inline: true },
        { name: 'Permissões', value: displayedPermissions || 'Nenhuma' },
        { name: 'Criado em', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:f>` }
      )
      .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  }
};