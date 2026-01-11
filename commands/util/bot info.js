const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const os = require('os');
const moment = require('moment');
const packageJson = require('../../package.json');

const emojis = {
    bot: '<:eg_bot:1353597099563946026>',
    owner: '<:icons_owner:1353597329776578682>',
    uptime: '<:eg_hourclock:1353597129737637981>',
    servers: '<:icons_rspartner:1353597750171799603>',
    users: '<:icons_people:1353597189414457429>',
    channels: '<:eg_channels:1353597104039399506>',
    ping: '<:icons_goodping:1353597280816463946>',
    ram: '<:eg_cloud:1353597105582637097>',
    cpu: '<:icons_loading:1353597302522253372>',
    os: '<:icons_monitor:1353597313100157019>',
    node: '<:icons_nodejs:1353597791066132510>',
    discordjs: '<:icons_discordjs:1353597779737575435>',
    arrowLeft: '<:icons_leftarrow:1353597444918607882>',
    arrowRight: '<:icons_rightarrow:1353597358742568980>',
    calendar: '<:icons_calendar1:1353597221332975657>',
    id: '<:icons_id:1353597440556662795>',
    version: '<:icons_discordjs:1353597771923325029>',
    globe: '<:icons_globe:1353597279923081268>',
    link: '<:eg_openpage:1353597148742029395>',
    graph: '📊'
};

// Traduções multilíngue básicas
const langs = {
    'pt-BR': {
        lang: 'Português (Brasil)',
        moreInfo: `[QUER SABER MAIS SOBRE MIM? CLIQUE AQUI.](https://mightward.abccloud.com.br)`,
        pages: ['Informações do Bot - Página 1', 'Informações do Bot - Página 2', 'Estatísticas Técnicas - Página 3'],
        onlyUser: '❌ Apenas quem usou o comando pode navegar pelas páginas!',
        error: '❌ Ocorreu um erro ao processar o comando.'
    },
    'en': {
        lang: 'English',
        moreInfo: `[WANT TO KNOW MORE ABOUT ME? CLICK HERE.](https://mightward.abccloud.com.br)`,
        pages: ['Bot Info - Page 1', 'Bot Info - Page 2', 'Tech Stats - Page 3'],
        onlyUser: '❌ Only the user who used the command can navigate the pages!',
        error: '❌ An error occurred while executing the command.'
    }
};

function getLang(locale) {
    return langs[locale] || langs['pt-BR'];
}

const createEmbeds = (bot, interaction, locale = 'pt-BR') => {
    const lang = getLang(locale);
    const uptime = moment.duration(bot.uptime).humanize();
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const cpuInfo = os.cpus()[0];
    const cpuModel = cpuInfo.model;
    const cpuCores = os.cpus().length;
    const totalMemory = (os.totalmem() / 1024 / 1024).toFixed(2);
    const usedMemory = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(2);
    const memoryPercentage = ((usedMemory / totalMemory) * 100).toFixed(2);
    const botCreatedAt = moment(bot.user.createdAt).format('DD/MM/YYYY HH:mm:ss');
    const botId = bot.user.id;
    const botVersion = packageJson.version;
    const platform = os.platform();
    const inviteLink = lang.moreInfo;

    let totalUsers = 0;
    bot.guilds.cache.forEach(g => totalUsers += g.memberCount);

    const embed1 = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`${emojis.bot} ${lang.pages[0]}`)
        .setThumbnail(bot.user.displayAvatarURL())
        .addFields(
            { name: `${emojis.bot} Nome`, value: `**${bot.user.username}**`, inline: true },
            { name: `${emojis.owner} Dono`, value: `<@1033922089436053535>`, inline: true },
            { name: `${emojis.id} ID`, value: `\`${botId}\``, inline: true },
            { name: `${emojis.calendar} Criado em`, value: botCreatedAt, inline: true },
            { name: `${emojis.version} Versão`, value: botVersion, inline: true },
            { name: `${emojis.uptime} Online há`, value: uptime, inline: true },
            { name: `${emojis.servers} Servidores`, value: `${bot.guilds.cache.size}`, inline: true },
            { name: `${emojis.users} Usuários`, value: `${totalUsers.toLocaleString()}`, inline: true },
            { name: `${emojis.channels} Canais`, value: `${bot.channels.cache.size}`, inline: true }
        )
        .setFooter({ text: `Página 1/3 | ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    const embed2 = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`${emojis.bot} ${lang.pages[1]}`)
        .setThumbnail(bot.user.displayAvatarURL())
        .addFields(
            { name: `${emojis.ping} Ping`, value: `${bot.ws.ping}ms`, inline: true },
            { name: `${emojis.ram} RAM usada`, value: `${memoryUsage} MB`, inline: true },
            { name: `${emojis.cpu} CPU`, value: `${cpuModel} (${cpuCores} cores)`, inline: true },
            { name: `${emojis.ram} Memória total`, value: `${totalMemory} MB`, inline: true },
            { name: `${emojis.ram} Memória usada`, value: `${usedMemory} MB (${memoryPercentage}%)`, inline: true },
            { name: `${emojis.os} Sistema`, value: `${platform}`, inline: true },
            { name: `${emojis.globe} Idioma`, value: lang.lang, inline: true },
            { name: `${emojis.link} Me adicione`, value: inviteLink, inline: false }
        )
        .setFooter({ text: `Página 2/3 | ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    const embed3 = new EmbedBuilder()
    .setColor('Blue')
    .setTitle(`${emojis.graph} ${lang.pages[2]}`)
    .addFields(
        { name: `${emojis.node} Node.js`, value: process.version, inline: true },
        { name: `${emojis.discordjs} Discord.js`, value: packageJson.dependencies['discord.js'], inline: true },
        ...(interaction.guild?.shardId > 0 ? [{ name: 'Shard ID', value: `${interaction.guild.shardId}`, inline: true }] : []),
        { name: 'Threads Ativas', value: `${os.cpus().length}`, inline: true },
        { name: 'Uptime Técnico', value: `${process.uptime().toFixed(0)}s`, inline: true }
    )
    .setFooter({ text: `Página 3/3 | ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

    return [embed1, embed2, embed3];
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('「Utilidades」Comandos relacionados ao bot.')
        .addSubcommand(sub =>
            sub.setName('info').setDescription('「Utilidades」Exibe informações detalhadas do bot.')
        ),

    async execute(interaction) {
        try {
            const bot = interaction.client;
            const locale = interaction.locale || 'pt-BR';
            const embeds = createEmbeds(bot, interaction, locale);
            let currentPage = 0;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Anterior').setEmoji(emojis.arrowLeft).setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('next_page').setLabel('Próxima').setEmoji(emojis.arrowRight).setStyle(ButtonStyle.Primary)
            );

            const message = await interaction.reply({ embeds: [embeds[currentPage]], components: [row], fetchReply: true });

            const collector = message.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id)
                    return i.reply({ content: getLang(locale).onlyUser, ephemeral: true });

                if (i.customId === 'prev_page' && currentPage > 0) currentPage--;
                if (i.customId === 'next_page' && currentPage < embeds.length - 1) currentPage++;

                row.components[0].setDisabled(currentPage === 0);
                row.components[1].setDisabled(currentPage === embeds.length - 1);

                await i.update({ embeds: [embeds[currentPage]], components: [row] });
            });

            collector.on('end', () => {
                row.components.forEach(b => b.setDisabled(true));
                message.edit({ components: [row] }).catch(console.error);
            });

        } catch (err) {
            console.error('Erro ao executar /bot info:', err);
            if (!interaction.replied) {
                await interaction.reply({ content: getLang(interaction.locale).error, ephemeral: true });
            }
        }
    }
};