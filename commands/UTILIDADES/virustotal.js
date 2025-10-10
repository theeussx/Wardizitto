const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { uploadFileToVirusTotal, analyzeUrl, analyzeIP, analyzeDomain, fetchAnalysis } = require('../../utils/virusTotal');
const cooldown = new Set();

const EMOJIS = {
    search: '<:icons_search:1353597363671011358>',
    correct: '<:icons_correct:1353597185542979664>',
    wrong: '<:icons_wrong:1353597190920212573>',
    hourclock: '<:eg_hourclock:1353597129737637981>',
    files: '<:eg_files:1353597118144708618>',
    alert: '<:icons_exclamation:1353597263913553971>'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('virustotal')
        .setDescription('「Utilidades」Analise URLs, IPs, domínios ou arquivos no VirusTotal!'),

    async execute(interaction) {
        if (cooldown.has(interaction.user.id)) {
            return interaction.reply({ content: `${EMOJIS.hourclock} Espere 1 minuto para usar novamente!`, ephemeral: true });
        }

        const select = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('vt_select')
                    .setPlaceholder('Escolha o tipo de análise')
                    .addOptions([
                        { label: 'URL', value: 'url' },
                        { label: 'IP', value: 'ip' },
                        { label: 'Domínio', value: 'domain' },
                        { label: 'Arquivo', value: 'file' }
                    ])
            );

        await interaction.reply({ content: `${EMOJIS.search} Escolha o que deseja analisar:`, components: [select], ephemeral: true });

        const collector = interaction.channel.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (i.customId !== 'vt_select' || i.user.id !== interaction.user.id) return;

            const type = i.values[0];
            await i.update({ content: `Envie agora o ${type === 'file' ? `${EMOJIS.files} Arquivo (anexado)` : `**${type.toUpperCase()}**`} que você quer analisar!`, components: [], ephemeral: true });

            const filter = m => m.author.id === interaction.user.id;
            const msgCollector = i.channel.createMessageCollector({ filter, max: 1, time: 30000 });

            msgCollector.on('collect', async (message) => {
                await message.delete().catch(() => {});

                try {
                    let analysisData;
                    if (type === 'file') {
                        if (!message.attachments.size) {
                            return interaction.followUp({ content: `${EMOJIS.alert} Você precisa anexar um arquivo!`, ephemeral: true });
                        }

                        const file = message.attachments.first();
                        if (file.size > 32 * 1024 * 1024) {
                            return interaction.followUp({ content: `${EMOJIS.wrong} Arquivo muito grande! O limite é **32MB**.`, ephemeral: true });
                        }

                        analysisData = await uploadFileToVirusTotal(file.url);
                    } else if (type === 'url') {
                        analysisData = await analyzeUrl(message.content.trim());
                    } else if (type === 'ip') {
                        analysisData = await analyzeIP(message.content.trim());
                    } else if (type === 'domain') {
                        analysisData = await analyzeDomain(message.content.trim());
                    }

                    if (!analysisData) {
                        return interaction.followUp({ content: `${EMOJIS.wrong} Erro ao enviar para o VirusTotal.`, ephemeral: true });
                    }

                    const link = `https://www.virustotal.com/gui/object/${analysisData.id.replace(/-/g, '')}/detection`;

                    const embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.search} VirusTotal Análise Inicial`)
                        .setDescription(`Escolha se deseja **aguardar** a análise ou **ver direto** no site.`)
                        .setColor(0x5865f2)
                        .setFooter({ text: 'Powered by VirusTotal', iconURL: 'https://www.virustotal.com/static/images/favicon.ico' });

                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('wait')
                                .setLabel('⏳ Aguardar Resultado')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setLabel('🌐 Ver no Site')
                                .setStyle(ButtonStyle.Link)
                                .setURL(link)
                        );

                    await interaction.followUp({ embeds: [embed], components: [buttons] });

                    const buttonCollector = interaction.channel.createMessageComponentCollector({ filter: btn => btn.user.id === interaction.user.id, time: 60000 });

                    buttonCollector.on('collect', async (btn) => {
                        if (btn.customId === 'wait') {
                            await btn.update({ content: `${EMOJIS.hourclock} Aguardando análise...`, embeds: [], components: [], ephemeral: true });

                            const finalData = await fetchAnalysis(analysisData.id);
                            if (!finalData) {
                                return interaction.followUp({ content: `${EMOJIS.wrong} Erro ao buscar resultado final.`, ephemeral: true });
                            }

                            const stats = finalData.attributes.last_analysis_stats;

                            const detailedResults = Object.entries(finalData.attributes.last_analysis_results)
                                .filter(([, result]) => result.category !== 'harmless')
                                .map(([engine, result]) => `> - ${engine}: **${result.category.toUpperCase()}**`)
                                .join('\n') || '> Nenhuma detecção crítica.';

                            const resultEmbed = new EmbedBuilder()
                                .setTitle(`${stats.malicious > 0 ? EMOJIS.wrong : EMOJIS.correct} Resultado da Análise`)
                                .setColor(stats.malicious > 0 ? 0xED4245 : 0x57F287)
                                .addFields(
                                    { name: 'Maliciosos', value: `${stats.malicious}`, inline: true },
                                    { name: 'Suspeitos', value: `${stats.suspicious}`, inline: true },
                                    { name: 'Harmless', value: `${stats.harmless}`, inline: true },
                                    { name: 'Resultados Detalhados', value: detailedResults.substring(0, 1000) }
                                )
                                .setURL(link)
                                .setFooter({ text: 'VirusTotal Scan', iconURL: 'https://www.virustotal.com/static/images/favicon.ico' })
                                .setTimestamp();

                            await interaction.followUp({ embeds: [resultEmbed] });
                        }
                    });

                    cooldown.add(interaction.user.id);
                    setTimeout(() => cooldown.delete(interaction.user.id), 60000);

                } catch (err) {
                    console.error(err);
                    await interaction.followUp({ content: `${EMOJIS.wrong} Ocorreu um erro na análise.`, ephemeral: true });
                }
            });
        });
    }
};