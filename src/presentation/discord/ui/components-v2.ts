import {
  ActionRowBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  resolveColor,
  type ButtonBuilder,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
  type SectionBuilder,
} from 'discord.js';

import emojiMap from '../../../core/config/emojis.json';

export { MessageFlags };

/**
 * Paleta de cores padronizada do design system.
 *
 * Os módulos devem referenciar essas constantes em vez de números mágicos,
 * mantendo a identidade visual consistente entre comandos.
 */
export const Colors = {
  Blurple: 0x5865f2,
  Green: 0x57f287,
  Yellow: 0xfee75c,
  Fuchsia: 0xeb459e,
  Red: 0xed4245,
  White: 0xffffff,
  Black: 0x000000,
  Grey: 0x2f3136,
  DarkGrey: 0x2b2d31,
  Pink: 0xffc0cb,
  Purple: 0x9b59b6,
  Blue: 0x3498db,
  Orange: 0xe67e22,
  Teal: 0x1abc9c,
} as const;

const emojiId = (name: string, animated: boolean): string | undefined => {
  const group: Readonly<Record<string, string>> = animated ? emojiMap.animated : emojiMap.static;
  return group[name];
};

/**
 * Resolve um emoji personalizado pelo nome registrado em `core/config/emojis.json`.
 *
 * Retorna a string de menção `<:nome:id>` (ou `<a:nome:id>` quando animado) ou uma
 * string vazia quando o emoji não existe, evitando IDs Discord hardcoded nos módulos.
 */
export function emoji(name: string, animated = false): string {
  const id = emojiId(name, animated);
  if (id === undefined) return '';
  return `<${animated ? 'a' : ''}:${name}:${id}>`;
}

/**
 * Retorna a URL CDN de um emoji registrado (útil para rodapés e acessórios).
 */
export function emojiURL(name: string, animated = false): string {
  const id = emojiId(name, animated);
  if (id === undefined) return '';
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`;
}

type ColorResolvable = Parameters<typeof resolveColor>[0];

interface FieldLike {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * `LabelBuilder` é o substituto dos embeds legados na camada de apresentação.
 *
 * Ele encapsula os builders de *Display Components* (Container/TextDisplay/Separator/
 * Section/MediaGallery) do Discord e expõe uma API declarativa e fluente. Os módulos
 * usam `LabelBuilder` para construir qualquer conteúdo visual, mantendo o design system
 * centralizado em um único arquivo e proibindo embeds legados na apresentação.
 */
export class LabelBuilder {
  private readonly container = new ContainerBuilder();
  private readonly rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  private title?: string;
  private url?: string;
  private footerText?: string;
  private timestamp?: Date;

  /** Define o título (cabeçalho) do rótulo. */
  setTitle(text: string): this {
    this.title = text;
    return this;
  }

  /** Define o texto principal (corpo) do rótulo. */
  setDescription(text: string): this {
    this.container.addTextDisplayComponents((component) => component.setContent(text));
    return this;
  }

  /** Define a cor de destaque do container. Aceita número, hex ou nome de cor. */
  setColor(color: ColorResolvable): this {
    this.container.setAccentColor(resolveColor(color));
    return this;
  }

  /** Alias explícito para a cor de destaque do container. */
  setAccentColor(color: ColorResolvable): this {
    return this.setColor(color);
  }

  /** Adiciona um campo com nome e valor. */
  addField(name: string, value: string, inline = false): this {
    this.container.addTextDisplayComponents((component) =>
      component.setContent(inline ? `**${name}:** ${value}` : `**${name}**\n${value}`),
    );
    return this;
  }

  /** Adiciona vários campos de uma vez. */
  addFields(...fields: readonly FieldLike[]): this {
    for (const field of fields) this.addField(field.name, field.value, field.inline ?? false);
    return this;
  }

  /** Adiciona um texto simples ao corpo do rótulo. */
  addText(content: string): this {
    this.container.addTextDisplayComponents((component) => component.setContent(content));
    return this;
  }

  /** Adiciona um separador visual. */
  addSeparator(): this {
    this.container.addSeparatorComponents(new SeparatorBuilder());
    return this;
  }

  /** Define o rodapé do rótulo. */
  setFooter(text: string, iconURL?: string): this {
    this.footerText = text;
    void iconURL;
    return this;
  }

  /** Define a marca temporal exibida no rodapé. */
  setTimestamp(date?: Date | number): this {
    this.timestamp = date === undefined ? new Date() : date instanceof Date ? date : new Date(date);
    return this;
  }

  /** Adiciona uma imagem em largura total (media gallery). */
  setImage(url: string): this {
    this.container.addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(url)),
    );
    return this;
  }

  /** Adiciona uma miniatura ao lado do texto (thumbnail accessory). */
  setThumbnail(url: string): this {
    this.container.addSectionComponents((section) =>
      section
        .addTextDisplayComponents((component) => component.setContent(' '))
        .setThumbnailAccessory((thumbnail) => thumbnail.setURL(url)),
    );
    return this;
  }

  /** Define o autor exibido no topo do rótulo. */
  setAuthor(name: string, iconURL?: string, url?: string): this {
    const label = url === undefined ? `**${name}**` : `[**${name}**](${url})`;
    this.container.addTextDisplayComponents((component) => component.setContent(label));
    void iconURL;
    return this;
  }

  /** Associa um link ao título do rótulo. */
  setURL(url: string): this {
    this.url = url;
    return this;
  }

  /** Adiciona uma seção (texto + acessório) ao container. */
  addSection(builder: (section: SectionBuilder) => SectionBuilder): this {
    this.container.addSectionComponents(builder);
    return this;
  }

  /** Adiciona um botão como acessório de uma nova seção com o texto informado. */
  addButtonSection(text: string, button: ButtonBuilder): this {
    return this.addSection((section) =>
      section
        .addTextDisplayComponents((component) => component.setContent(text))
        .setButtonAccessory(button),
    );
  }

  /** Adiciona uma linha de ação (botões/selects) ao rótulo. */
  addActionRow(...components: readonly MessageActionRowComponentBuilder[]): this {
    this.rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components),
    );
    return this;
  }

  /** Adiciona uma linha de ação pronta ao rótulo. */
  addActionRowBuilder(row: ActionRowBuilder<MessageActionRowComponentBuilder>): this {
    this.rows.push(row);
    return this;
  }

  /** Retorna o container construído (para compor com outras linhas no `components`). */
  build(): ContainerBuilder {
    this.applyHeader();
    this.applyFooter();
    return this.container;
  }

  /** Serializa o rótulo em componentes prontos para `components: [...]`. */
  toComponents(): readonly (
    ContainerBuilder | ActionRowBuilder<MessageActionRowComponentBuilder>
  )[] {
    return [this.build(), ...this.rows];
  }

  /** Serializa o rótulo em payload de mensagem com o flag de Components V2. */
  toMessageOptions(): {
    components: readonly (ContainerBuilder | ActionRowBuilder<MessageActionRowComponentBuilder>)[];
    flags: typeof MessageFlags.IsComponentsV2;
  } {
    return { components: this.toComponents(), flags: MessageFlags.IsComponentsV2 };
  }

  private applyHeader(): void {
    if (this.title === undefined) return;
    const text = this.url === undefined ? `## ${this.title}` : `## [${this.title}](${this.url})`;
    this.container.spliceComponents(0, 0, new TextDisplayBuilder().setContent(text));
  }

  private applyFooter(): void {
    if (this.footerText === undefined && this.timestamp === undefined) return;
    const parts: string[] = [];
    if (this.footerText !== undefined) parts.push(this.footerText);
    if (this.timestamp !== undefined) {
      parts.push(`<t:${String(Math.floor(this.timestamp.getTime() / 1000))}:f>`);
    }
    this.container.addTextDisplayComponents((component) =>
      component.setContent(`-# ${parts.join(' · ')}`),
    );
  }
}

/** Configuração de um campo de texto de modal. */
export interface ModalInputConfig {
  readonly customId: string;
  readonly label: string;
  readonly style?: TextInputStyle;
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly value?: string;
  readonly placeholder?: string;
}

/** Configuração declarativa de um modal. */
export interface ModalConfig {
  readonly customId: string;
  readonly title: string;
  readonly fields: readonly ModalInputConfig[];
}

/**
 * Cria um modal a partir de uma configuração declarativa.
 *
 * Centraliza `ModalBuilder` e `TextInputBuilder` no design system, de modo que os
 * módulos não os utilizem diretamente.
 */
export function createModal(config: ModalConfig): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(config.customId).setTitle(config.title);
  const rows = config.fields.map((field) => {
    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      // O rótulo de texto de entrada continua sendo uma string na API do Discord.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      .setLabel(field.label)
      .setStyle(field.style ?? TextInputStyle.Short);
    if (field.required !== undefined) input.setRequired(field.required);
    if (field.minLength !== undefined) input.setMinLength(field.minLength);
    if (field.maxLength !== undefined) input.setMaxLength(field.maxLength);
    if (field.value !== undefined) input.setValue(field.value);
    if (field.placeholder !== undefined) input.setPlaceholder(field.placeholder);
    return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
  });
  // Text inputs ainda são adicionados ao modal através de linhas de ação.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  modal.addComponents(...rows);
  return modal;
}

/** Re-exporta o `MediaGalleryBuilder` para galerias customizadas. */
export { MediaGalleryBuilder };
