const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const emojis = { emojis: '<:eg_emojis:1353597114017648821>',
                 channels: '<:eg_channels:1353597104039399506>',
                 roles: '<:icons_roles:1353597621423575072>',
                 description: '<:icons_info:1353597290555637780>',
                 globe: '<:eg_globe:1353597122204667904>',
                 owner: '<:icons_owner:1353597329776578682>',
                 member: '<:eg_member:1353597138411585628>',
                 calendar: '<:icons_calendar1:1353597221332975657>',
                 boost: '<:eg_star:1353597159752077419>' 
               };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('「Utilidades」Mostra informações sobre o servidor atual ou especificado.')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('ID do servidor que deseja ver as informações (opcional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    
    let guild;
    const serverId = interaction.options.getString('server-id');
    
    if (serverId) {
      // Tentar encontrar o servidor pelo ID fornecido
      guild = interaction.client.guilds.cache.get(serverId);
      
      if (!guild) {
        try {
          guild = await interaction.client.guilds.fetch(serverId);
        } catch (error) {
          return interaction.editReply({ 
            content: '❌ Não foi possível encontrar o servidor com o ID fornecido ou o bot não está nele.',
            ephemeral: true
          });
        }
      }
    } else {
      // Usar o servidor atual se nenhum ID for fornecido
      guild = interaction.guild;
    }

    if (!guild) {
      return interaction.editReply({ 
        content: '❌ Servidor não encontrado.',
        ephemeral: true
      });
    }

    const owner = await guild.fetchOwner();

    const serverName = guild.name;
    const serverIcon = guild.iconURL({ dynamic: true, size: 1024 });
    const memberCount = guild.memberCount;
    const creationDate = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
    const rolesCount = guild.roles.cache.size;
    const channelsCount = guild.channels.cache.size;
    const boostLevel = guild.premiumTier;
    const boosts = guild.premiumSubscriptionCount;

    const voiceChannel = guild.channels.cache.find(c => c.type === 2 && c.rtcRegion);
    const region = voiceChannel?.rtcRegion
      ? `🌐 ${voiceChannel.rtcRegion.charAt(0).toUpperCase() + voiceChannel.rtcRegion.slice(1)}`
      : '🌐 Automática';

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.globe} ${serverName}`)
      .setThumbnail(serverIcon)
      .setColor('#5865F2')
      .addFields(
  { name: `${emojis.owner} Dono(a)`, value: `<@${owner.id}> \`(${owner.id})\``, inline: false },
  { name: `${emojis.member} Membros`, value: `${memberCount}`, inline: true },
  { name: `${emojis.boost} Boosts`, value: `${boosts} (Nível ${boostLevel})`, inline: true },
  { name: `${emojis.channels} Canais`, value: `${channelsCount}`, inline: true },
  { name: `${emojis.roles} Cargos`, value: `${rolesCount}`, inline: true },
  { name: `${emojis.globe} Região`, value: region, inline: true },
  { name: `${emojis.calendar} Criado em`, value: `${creationDate}`, inline: false }
)
      .setFooter({ text: `ID do servidor: ${guild.id}` })
      .setTimestamp();

    const createButtons = (disabled = false) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`emojis_${guild.id}`) // Adiciona ID do servidor ao customId
          .setLabel('Emojis')
          .setEmoji(emojis.emojis)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId(`canais_${guild.id}`)
          .setLabel('Canais')
          .setEmoji(emojis.channels)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId(`cargos_${guild.id}`)
          .setLabel('Cargos')
          .setEmoji(emojis.roles)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),

        new ButtonBuilder()
          .setCustomId(`descricao_${guild.id}`)
          .setLabel('Descrição')
          .setEmoji(emojis.description)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      );
    };

    const message = await interaction.editReply({ 
      embeds: [embed], 
      components: [createButtons()] 
    });

    const collector = message.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 60000,
      filter: i => {
        // Verifica se o ID do servidor no botão corresponde ao servidor atual
        const buttonGuildId = i.customId.split('_')[1];
        return buttonGuildId === guild.id && i.user.id === interaction.user.id;
      }
    });

    collector.on('collect', async i => {
      const [action, guildId] = i.customId.split('_');
      const targetGuild = interaction.client.guilds.cache.get(guildId);
      
      if (!targetGuild) {
        return i.reply({ 
          content: '❌ Não foi possível encontrar o servidor.', 
          ephemeral: true 
        });
      }

      let embedResposta;

      if (action === 'emojis') {
        const emojisList = targetGuild.emojis.cache.map(e => `${e} \`${e.name}\``).join('\n').slice(0, 4000) || 'Nenhum emoji encontrado.';
        embedResposta = new EmbedBuilder()
          .setTitle(`${emojis.emojis} Emojis (${targetGuild.emojis.cache.size})`)
          .setDescription(emojisList)
          .setColor('Yellow');

      } else if (action === 'canais') {
        const canais = targetGuild.channels.cache
          .map(c => `• ${c.name} (${c.type === 0 ? 'Texto' : c.type === 2 ? 'Voz' : 'Outro'})`)
          .slice(0, 40)
          .join('\n') || 'Nenhum canal encontrado.';
        embedResposta = new EmbedBuilder()
          .setTitle(`${emojis.channels} Canais (${targetGuild.channels.cache.size})`)
          .setDescription(canais)
          .setColor('Blurple');

      } else if (action === 'cargos') {
        const roles = targetGuild.roles.cache.sort((a, b) => b.position - a.position)
          .map(r => `${r.name} \`(${r.id})\``).slice(0, 40).join('\n') || 'Nenhum cargo encontrado.';
        embedResposta = new EmbedBuilder()
          .setTitle(`${emojis.roles} Cargos (${targetGuild.roles.cache.size})`)
          .setDescription(roles)
          .setColor('Green');

      } else if (action === 'descricao') {
        const desc = targetGuild.description || 'Esse servidor não possui uma descrição definida.';
        embedResposta = new EmbedBuilder()
          .setTitle(`${emojis.description} Descrição do Servidor`)
          .setDescription(desc)
          .setColor('Orange');
      }

      await i.reply({ embeds: [embedResposta], ephemeral: true });
    });

    collector.on('end', () => {
      message.edit({ components: [createButtons(true)] }).catch(() => {});
    });
  }
};