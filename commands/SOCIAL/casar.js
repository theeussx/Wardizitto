const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { pool } = require('../../handlers/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casar')
    .setDescription('「Social」Proponha casamento a outro usuário.')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Quem você quer casar?').setRequired(true)
    ),

  async execute(interaction) {
    const proponente = interaction.user;
    const alvo = interaction.options.getUser('usuario');
    const membroAlvo = interaction.guild.members.cache.get(alvo.id);
    const membroProponente = interaction.guild.members.cache.get(proponente.id);

    if (proponente.id === alvo.id)
      return interaction.reply({ content: 'Você não pode se casar consigo mesmo!', ephemeral: true });

    const [casado1] = await pool.query('SELECT * FROM casamentos WHERE user_id = ? OR parceiro_id = ?', [proponente.id, proponente.id]);
    const [casado2] = await pool.query('SELECT * FROM casamentos WHERE user_id = ? OR parceiro_id = ?', [alvo.id, alvo.id]);

    if (casado1.length > 0) return interaction.reply({ content: 'Você já está casado!', ephemeral: true });
    if (casado2.length > 0) return interaction.reply({ content: 'Esse usuário já está casado!', ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`aceitar_casamento_${proponente.id}`)
        .setLabel('Aceitar pedido de casamento')
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setTitle('Pedido de Casamento!')
      .setDescription(`${proponente} quer se casar com ${alvo}! Clique no botão abaixo para aceitar.`)
      .setColor('Blue');

    await interaction.reply({ content: `${alvo}`, embeds: [embed], components: [row] });

    const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.customId !== `aceitar_casamento_${proponente.id}` || i.user.id !== alvo.id) return;

      await pool.query('INSERT INTO casamentos (user_id, parceiro_id, data) VALUES (?, ?, ?)', [proponente.id, alvo.id, Date.now()]);

      try {
        if (membroAlvo && membroAlvo.manageable) await membroAlvo.setNickname(`Casado(a) com ${proponente.username}`);
        if (membroProponente && membroProponente.manageable) await membroProponente.setNickname(`Casado(a) com ${alvo.username}`);
      } catch (err) {
        console.log('Erro ao mudar apelido:', err);
      }

      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('Casamento Realizado!')
            .setDescription(`${proponente} e ${alvo} agora estão casados!`)
            .setColor('Green')
        ],
        components: []
      });
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.editReply({ content: 'O pedido de casamento expirou.', components: [] });
      }
    });
  }
};