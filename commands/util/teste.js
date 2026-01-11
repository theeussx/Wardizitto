const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counter')
        .setDescription('Counter command 🔢'),
    async execute(interaction) {
        let current = 0;

        const createCounterComponents = (value) => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`counter_reset`)
                        .setLabel('Reset')
                        .setStyle(
                            value > 0 ? ButtonStyle.Primary :
                            value < 0 ? ButtonStyle.Danger :
                            ButtonStyle.Secondary
                        )
                        .setDisabled(value === 0)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`counter_increment`)
                        .setLabel('+')
                        .setStyle(ButtonStyle.Success)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`counter_decrement`)
                        .setLabel('-')
                        .setStyle(ButtonStyle.Danger)
                )
            ];
        };

        await interaction.reply({
            content: `## Current value: \`${current}\``,
            components: createCounterComponents(current),
            ephemeral: true
        });

        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: i => i.user.id === interaction.user.id
        });

        collector.on('collect', async i => {
            if (!i.customId.startsWith('counter')) return;

            if (i.customId === 'counter_reset') current = 0;
            if (i.customId === 'counter_increment') current++;
            if (i.customId === 'counter_decrement') current--;

            await i.update({
                content: `## Current value: \`${current}\``,
                components: createCounterComponents(current)
            });
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({
                    components: []
                });
            } catch (e) {}
        });
    }
};