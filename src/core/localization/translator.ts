export type Locale = 'pt-BR' | 'en-US';

const messages = {
  'pt-BR': {
    'error.internal': '⚠️ Não foi possível concluir esta ação. Tente novamente mais tarde.',
    'error.guildOnly': '❌ Este comando só pode ser usado em um servidor.',
    'error.permission': '❌ Você não tem permissão para executar esta ação.',
    'error.commandMissing': '❌ Este comando não está disponível nesta versão.',
    'error.rateLimit': '⏳ Muitas solicitações. Tente novamente em {seconds}s.',
  },
  'en-US': {
    'error.internal': '⚠️ This action could not be completed. Please try again later.',
    'error.guildOnly': '❌ This command can only be used in a server.',
    'error.permission': '❌ You do not have permission to perform this action.',
    'error.commandMissing': '❌ This command is not available in this version.',
    'error.rateLimit': '⏳ Too many requests. Try again in {seconds}s.',
  },
} as const;

export type MessageKey = keyof (typeof messages)['pt-BR'];

export class Translator {
  public constructor(private readonly fallbackLocale: Locale) {}

  public translate(
    key: MessageKey,
    locale: Locale = this.fallbackLocale,
    variables: Readonly<Record<string, string | number>> = {},
  ): string {
    let value: string = messages[locale][key];
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  }
}
