const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('「Moderação」Adiciona um cargo a um membro.')
    .addUserOption((option) =>
      option.setName('usuário').setDescription('O membro que receberá o cargo.').setRequired(true),
    )
    .addRoleOption((option) =>
      option.setName('cargo').setDescription('O cargo a ser atribuído.').setRequired(true),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('usuário');
    const role = interaction.options.getRole('cargo');
    const targetMember = interaction.guild.members.cache.get(user.id);

    const ephemeral = (label) =>
      interaction.reply({
        components: [label.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return ephemeral(
        new LabelBuilder()
          .setColor(Colors.Red)
          .setDescription(
            `${emoji('eg_cross')} Você precisa da permissão \`Gerenciar Cargos\` para usar este comando.`,
          ),
      );
    }

    if (!targetMember) {
      return ephemeral(
        new LabelBuilder()
          .setColor(Colors.Red)
          .setDescription(`${emoji('eg_cross')} Membro não encontrado.`),
      );
    }

    if (targetMember.roles.cache.has(role.id)) {
      return ephemeral(
        new LabelBuilder()
          .setColor('Yellow')
          .setDescription(`${emoji('eg_excl')} O usuário já possui o cargo \`${role.name}\`.`),
      );
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return ephemeral(
        new LabelBuilder()
          .setColor(Colors.Red)
          .setDescription(
            `${emoji('eg_cross')} Não consigo atribuir esse cargo, pois está acima do meu na hierarquia.`,
          ),
      );
    }

    if (
      targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position
    ) {
      return ephemeral(
        new LabelBuilder()
          .setColor(Colors.Red)
          .setDescription(
            `${emoji('eg_cross')} Não posso modificar os cargos deste membro devido à hierarquia.`,
          ),
      );
    }

    try {
      await targetMember.roles.add(role);

      const successLabel = new LabelBuilder()
        .setColor(Colors.Green)
        .setDescription(
          `${emoji('icons_correct')} O cargo \`${role.name}\` foi atribuído a **${user.tag}** com sucesso!`,
        );

      await interaction.reply({
        components: [successLabel.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      interaction.client.services.logger.error('Erro ao adicionar o cargo:', err);

      const errorLabel = new LabelBuilder()
        .setColor(Colors.Red)
        .setTitle(`${emoji('eg_cross')} Erro ao adicionar cargo`)
        .setDescription(
          err.message.includes('Missing Permissions')
            ? 'Permissões insuficientes. Verifique se o cargo do bot está configurado corretamente.'
            : 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
        );

      return interaction.reply({
        components: [errorLabel.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
