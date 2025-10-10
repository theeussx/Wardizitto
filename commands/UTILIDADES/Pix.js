const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doar')
    .setDescription('「Utilidades」Ajude o bot a continuar online com uma doação via Pix!'),

  async execute(interaction) {
    const chavePix = '54a06cc5-4955-44d4-8bdd-9fff2d0f29c7';
    const codigoPix = '00020126940014BR.GOV.BCB.PIX013654a06cc5-4955-44d4-8bdd-9fff2d0f29c70232Ajude o MightWard a ficar online5204000053039865802BR5925Mateus Henrique Alves Ole6009SAO PAULO62140510kpAF6lCijG630436C5';
    const logChannelId = '1374106662486671490'; // Altere para o ID do seu canal de logs

    const emojis = {
      pix: '<:icons_dollar:1353597252949770240>',
      coração: '<:eg_heart:1353597127091294208>',
      código: '<:icons_code:1353597423682981908>',
      tada: '<:icons_tada:1353597708371497010>'
    };

    try {
      // Gerar QR Code
      const qrBuffer = await QRCode.toBuffer(codigoPix, {
        errorCorrectionLevel: 'H',
        width: 300
      });
      const qrAttachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode-pix.png' });

      // Embed de doação
      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(`${emojis.pix} Ajude o projeto MightWard!`)
        .setDescription(`${emojis.coração} Obrigado por considerar apoiar o bot! Toda ajuda é muito bem-vinda.`)
        .addFields(
          { name: `${emojis.pix} Chave Pix`, value: `\`${chavePix}\`` },
          { name: `${emojis.código} Código Pix (Copia e Cola)`, value: `\`\`\`${codigoPix}\`\`\`` }
        )
        .setImage('attachment://qrcode-pix.png')
        .setFooter({ text: 'Muito obrigado pelo apoio!', iconURL: 'https://cdn.discordapp.com/emojis/1353597708371497010.webp' });

      // Botões
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Copiar Chave Pix')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('copiar_chave'),
        new ButtonBuilder()
          .setLabel('Abrir QR Code')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(codigoPix)}`)
      );

      await interaction.reply({
        embeds: [embed],
        files: [qrAttachment],
        components: [row],
        ephemeral: true
      });

      // Registrar transação no JSON
      const logData = {
        user: interaction.user.tag,
        userId: interaction.user.id,
        timestamp: new Date().toISOString()
      };

      const filePath = path.join(__dirname, '../../databases/doacoes.json');
      let historico = [];

      if (fs.existsSync(filePath)) {
        historico = JSON.parse(fs.readFileSync(filePath));
      }

      historico.push(logData);
      fs.writeFileSync(filePath, JSON.stringify(historico, null, 2));

      // Enviar log no canal
      const logChannel = interaction.client.channels.cache.get(logChannelId);
      if (logChannel?.isTextBased()) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Nova tentativa de doação!')
              .setDescription(`O usuário **${interaction.user.tag}** (\`${interaction.user.id}\`) usou o comando **/doar**.`)
              .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
              .setTimestamp()
          ]
        });
      }
    } catch (err) {
      console.error('Erro ao executar comando /doar:', err);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao gerar o QR Code.',
        ephemeral: true
      });
    }
  }
};