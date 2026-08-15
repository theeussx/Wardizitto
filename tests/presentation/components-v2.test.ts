import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  TextInputStyle,
} from 'discord.js';
import { describe, expect, it } from 'vitest';

import {
  Colors,
  LabelBuilder,
  createModal,
  emoji,
  emojiURL,
} from '../../src/presentation/discord/ui/components-v2.js';

const textContents = (json: {
  components: readonly { type: number; content?: string }[];
}): string[] =>
  json.components
    .filter((component) => component.content !== undefined)
    .map((component) => component.content ?? '');

describe('emoji', () => {
  it('resolve emoji estático registrado', () => {
    expect(emoji('eg_cross')).toBe('<:eg_cross:1353597108640415754>');
  });

  it('resolve emoji animado registrado', () => {
    expect(emoji('icons_logo', true)).toBe('<a:icons_logo:1353597304170483795>');
  });

  it('retorna string vazia para emoji inexistente', () => {
    expect(emoji('emoji_inexistente')).toBe('');
  });
});

describe('emojiURL', () => {
  it('resolve URL estática registrada', () => {
    expect(emojiURL('eg_cross')).toBe('https://cdn.discordapp.com/emojis/1353597108640415754.png');
  });

  it('resolve URL animada registrada', () => {
    expect(emojiURL('icons_logo', true)).toBe(
      'https://cdn.discordapp.com/emojis/1353597304170483795.gif',
    );
  });

  it('retorna string vazia para emoji inexistente', () => {
    expect(emojiURL('emoji_inexistente')).toBe('');
  });
});

describe('LabelBuilder', () => {
  it('serializa título, descrição e cor de destaque', () => {
    const json = new LabelBuilder()
      .setTitle('Olá')
      .setDescription('Mundo')
      .setColor(Colors.Blurple)
      .build()
      .toJSON();

    expect(json.type).toBe(ComponentType.Container);
    expect(json.accent_color).toBe(Colors.Blurple);
    const contents = textContents(json);
    expect(contents).toContain('## Olá');
    expect(contents).toContain('Mundo');
  });

  it('posiciona o título antes da descrição independente da ordem de chamada', () => {
    const json = new LabelBuilder().setDescription('Corpo').setTitle('Cabeçalho').build().toJSON();
    const contents = textContents(json);
    expect(contents[0]).toBe('## Cabeçalho');
  });

  it('gera componentes prontos para envio', () => {
    const components = new LabelBuilder().setTitle('x').toComponents();
    expect(components).toHaveLength(1);
  });

  it('gera opções de mensagem com flag de Components V2', () => {
    const options = new LabelBuilder().setTitle('x').toMessageOptions();
    expect(options.components).toHaveLength(1);
    expect(options.flags).toBe(32768);
  });

  it('adiciona campos, separador, rodapé e marca temporal', () => {
    const json = new LabelBuilder()
      .setTitle('Perfil')
      .addField('Saldo', '100 Wardcoins')
      .addSeparator()
      .setFooter('Wardizitto')
      .setTimestamp(new Date(0))
      .build()
      .toJSON();

    expect(json.components.some((component) => component.type === ComponentType.Separator)).toBe(
      true,
    );
    const text = textContents(json).join('\n');
    expect(text).toContain('**Saldo**');
    expect(text).toContain('100 Wardcoins');
    expect(text).toContain('Wardizitto');
  });

  it('aceita cores por nome e hexadecimal', () => {
    expect(new LabelBuilder().setColor('Red').build().toJSON().accent_color).toBe(0xed4245);
    expect(new LabelBuilder().setColor('#2f3136').build().toJSON().accent_color).toBe(0x2f3136);
  });

  it('aceita o alias setAccentColor', () => {
    expect(new LabelBuilder().setAccentColor(Colors.Green).build().toJSON().accent_color).toBe(
      Colors.Green,
    );
  });

  it('aceita marca temporal numérica e rodapé com ícone', () => {
    const json = new LabelBuilder()
      .setFooter('Rodapé', 'https://example.com/icon.png')
      .setTimestamp(0)
      .build()
      .toJSON();
    const text = textContents(json).join('\n');
    expect(text).toContain('Rodapé');
    expect(text).toContain('<t:0:f>');
  });

  it('adiciona autor com e sem link', () => {
    const comLink = new LabelBuilder()
      .setAuthor('Wardizitto', undefined, 'https://x')
      .build()
      .toJSON();
    expect(textContents(comLink)).toContain('[**Wardizitto**](https://x)');

    const semLink = new LabelBuilder().setAuthor('Wardizitto').build().toJSON();
    expect(textContents(semLink)).toContain('**Wardizitto**');
  });

  it('transforma o título em link quando setURL é usado', () => {
    const json = new LabelBuilder()
      .setTitle('Repositório')
      .setURL('https://example.com')
      .build()
      .toJSON();
    expect(textContents(json)).toContain('## [Repositório](https://example.com)');
  });

  it('adiciona imagem em galeria de mídia', () => {
    const json = new LabelBuilder().setImage('https://example.com/img.png').build().toJSON();
    expect(json.components.some((component) => component.type === ComponentType.MediaGallery)).toBe(
      true,
    );
  });

  it('adiciona miniatura como seção', () => {
    const json = new LabelBuilder().setThumbnail('https://example.com/thumb.png').build().toJSON();
    expect(json.components.some((component) => component.type === ComponentType.Section)).toBe(
      true,
    );
  });

  it('adiciona texto simples e múltiplos campos', () => {
    const json = new LabelBuilder()
      .addText('Texto solto')
      .addFields({ name: 'A', value: '1' }, { name: 'B', value: '2', inline: true })
      .build()
      .toJSON();
    const text = textContents(json).join('\n');
    expect(text).toContain('Texto solto');
    expect(text).toContain('**A**\n1');
    expect(text).toContain('**B:** 2');
  });

  it('adiciona seção com miniatura e seção com botão', () => {
    const button = new ButtonBuilder()
      .setCustomId('btn')
      .setLabel('Ação')
      .setStyle(ButtonStyle.Primary);
    const json = new LabelBuilder()
      .addSection((section) =>
        section
          .addTextDisplayComponents((t) => t.setContent('Seção'))
          .setThumbnailAccessory((t) => t.setURL('https://example.com/x.png')),
      )
      .addButtonSection('Com botão', button)
      .build()
      .toJSON();
    expect(
      json.components.filter((component) => component.type === ComponentType.Section),
    ).toHaveLength(2);
  });

  it('adiciona linhas de ação ao resultado', () => {
    const button = new ButtonBuilder()
      .setCustomId('btn')
      .setLabel('Ação')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const label = new LabelBuilder().setTitle('x').addActionRow(button).addActionRowBuilder(row);
    expect(label.toComponents()).toHaveLength(3);
  });

  it('não inclui rodapé quando não há rodapé nem marca temporal', () => {
    const json = new LabelBuilder().setDescription('Apenas texto').build().toJSON();
    expect(textContents(json).join('\n')).not.toContain('-#');
  });

  it('constrói modal através de createModal com campos', () => {
    const modal = createModal({
      customId: 'modal_exemplo',
      title: 'Exemplo',
      fields: [
        { customId: 'campo_a', label: 'Campo A', style: TextInputStyle.Short, required: true },
        {
          customId: 'campo_b',
          label: 'Campo B',
          style: TextInputStyle.Paragraph,
          maxLength: 2000,
          minLength: 1,
          value: 'valor',
          placeholder: 'Digite...',
        },
      ],
    }).toJSON();

    expect(modal.custom_id).toBe('modal_exemplo');
    expect(modal.title).toBe('Exemplo');
    expect(modal.components).toHaveLength(2);
  });
});
