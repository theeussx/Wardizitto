const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { pool } = require('../../../handlers/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('divorciar')
    .setDescription('「💔 Social」Divorcie-se do seu parceiro(a).'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Verifica se o usuário está em um casamento
    const [casamentos] = await pool.query(
      'SELECT * FROM casamentos WHERE user_id = ? OR parceiro_id = ?',
      [userId, userId]
    );

    if (!casamentos.length) {
      return interaction.reply({ content: '❌ Você não está casado(a).', ephemeral: true });
    }

    const casamento = casamentos[0];
    const parceiroId = casamento.user_id === userId ? casamento.parceiro_id : casamento.user_id;

    const parceiro = await interaction.guild.members.fetch(parceiroId).catch(() => null);
    const autor = interaction.member;

    if (!parceiro) {
      return interaction.reply({
        content: '❌ Não consegui encontrar seu parceiro(a) neste servidor.',
        ephemeral: true,
      });
    }

    // Botão de confirmação inicial
    const confirmarDivorcioBtn = new ButtonBuilder()
      .setCustomId('confirmar_divorcio')
      .setLabel('💔 Confirmar Divórcio')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmarDivorcioBtn);

    const msg = await interaction.reply({
      content: `Você tem certeza que quer se divorciar de <@${parceiroId}>?`,
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    // Coletor para o autor confirmar
    const filter = i => i.user.id === userId && i.customId === 'confirmar_divorcio';
    const confirmation = await msg.awaitMessageComponent({ filter, time: 30_000 }).catch(() => null);

    if (!confirmation) {
      return interaction.editReply({ content: '⏱️ Tempo esgotado para confirmar o divórcio.', components: [] });
    }

    // Solicita aprovação do parceiro
    const aceitarBtn = new ButtonBuilder()
      .setCustomId('aceitar_divorcio')
      .setLabel('✅ Aceitar Divórcio')
      .setStyle(ButtonStyle.Success);

    const recusarBtn = new ButtonBuilder()
      .setCustomId('recusar_divorcio')
      .setLabel('❌ Recusar')
      .setStyle(ButtonStyle.Secondary);

    const parceiroRow = new ActionRowBuilder().addComponents(aceitarBtn, recusarBtn);

    try {
      const msgParceiro = await parceiro.send({
        content: `💔 <@${userId}> quer se divorciar de você.\nVocê aceita o divórcio?`,
        components: [parceiroRow],
      });

      const parceiroFilter = i => i.user.id === parceiroId && ['aceitar_divorcio', 'recusar_divorcio'].includes(i.customId);
      const parceiroResponse = await msgParceiro.awaitMessageComponent({ filter: parceiroFilter, time: 60_000 }).catch(() => null);

      if (!parceiroResponse) {
        await msgParceiro.edit({ content: '⏱️ Tempo esgotado. O divórcio foi cancelado.', components: [] });
        return confirmation.update({ content: '❌ O parceiro(a) não respondeu a tempo. Divórcio cancelado.', components: [] });
      }

      if (parceiroResponse.customId === 'recusar_divorcio') {
        await parceiroResponse.update({ content: '❌ Você recusou o divórcio.', components: [] });
        return confirmation.update({ content: '❌ Seu parceiro(a) recusou o divórcio.', components: [] });
      }

      // Prossegue com o divórcio
      await pool.query('DELETE FROM casamentos WHERE id = ?', [casamento.id]);

      if (autor.manageable) await autor.setNickname(null).catch(() => {});
      if (parceiro.manageable) await parceiro.setNickname(null).catch(() => {});

      await parceiroResponse.update({ content: '💔 Divórcio realizado com sucesso.', components: [] });
      return confirmation.update({ content: `✅ Você se divorciou de <@${parceiroId}> com sucesso.`, components: [] });

    } catch (error) {
      console.error('Erro durante o processo de divórcio:', error);
      return interaction.editReply({
        content: '⚠️ Ocorreu um erro ao tentar realizar o divórcio. Tente novamente mais tarde.',
        components: [],
      });
    }
  },
};