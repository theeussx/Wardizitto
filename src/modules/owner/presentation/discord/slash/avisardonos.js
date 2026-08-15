const { isOwner } = require('../../../../../core/security/owner.js');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { LabelBuilder } = require('../../../../../presentation/discord/ui/components-v2.js');

const buildLabel = (titulo, descricao, cor, imagem) => {
  const label = new LabelBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor(cor)
    .setFooter('MightWard - Aviso oficial')
    .setTimestamp();
  if (imagem) label.setImage(imagem);
  return label;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avisar_donos')
    .setDescription('Envia uma embed personalizada para os donos dos servidores.')
    .addStringOption((option) =>
      option.setName('titulo').setDescription('Título da embed.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('descricao').setDescription('Descrição/conteúdo da embed.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('cor').setDescription('Cor em hexadecimal (ex: #ff0000).').setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('imagem')
        .setDescription('URL de uma imagem para adicionar à embed.')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '🚫 Apenas o dono do bot pode usar este comando.',
        ephemeral: true,
      });
    }

    const titulo = interaction.options.getString('titulo');
    const descricao = interaction.options.getString('descricao');
    const corHex = interaction.options.getString('cor') || '#f1c40f';
    const imagem = interaction.options.getString('imagem');
    const cor = corHex.startsWith('#') ? corHex : `#${corHex}`;

    const servidores = client.guilds.cache;
    let enviados = 0;
    let falhas = 0;

    await interaction.reply({
      content: `⏳ Enviando embed para **${servidores.size} servidores**...`,
      ephemeral: true,
    });

    for (const [, guild] of servidores) {
      try {
        const owner = await guild.fetchOwner();
        await owner.send({
          components: [buildLabel(titulo, descricao, cor, imagem).build()],
          flags: MessageFlags.IsComponentsV2,
        });
        enviados++;
      } catch {
        const canal = guild.channels.cache.find(
          (c) =>
            c.type === 0 && c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel']),
        );
        try {
          if (canal) {
            const label = buildLabel(
              titulo,
              `📢 **Mensagem para o dono (<@${guild.ownerId}>):**\n\n${descricao}`,
              cor,
              imagem,
            );
            await canal.send({
              components: [label.build()],
              flags: MessageFlags.IsComponentsV2,
            });
            enviados++;
          } else {
            falhas++;
          }
        } catch {
          falhas++;
        }
      }
    }

    await interaction.followUp({
      content: `✅ Embed enviada para **${enviados} servidores**.\n❌ Falhou em **${falhas} servidores**.`,
      ephemeral: true,
    });
  },
};
