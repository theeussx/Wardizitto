const messages = {
  'pt-BR': {
    denied: 'Você precisa gerenciar o servidor e os cargos para publicar o painel.',
    role: 'Escolha um cargo de participante abaixo do seu cargo e do cargo do bot.',
    title: 'Verificação',
    description: 'Confirme sua participação para receber',
    button: 'Verificar minha conta',
    published: 'Painel de verificação publicado.',
    guild: 'A verificação exige um servidor disponível.',
    screening: 'Aceite as regras deste servidor antes de solicitar seu cargo.',
    stale: 'Use o painel de verificação atual deste servidor.',
    missing: 'A equipe precisa configurar um cargo de participante com /verificacao.',
    verified: 'Verificação concluída. Seu cargo é',
  },
  'en-US': {
    denied: 'You need Manage Server and Manage Roles to publish the panel.',
    role: 'Choose a participant role below your highest role and the bot’s highest role.',
    title: 'Verification',
    description: 'Confirm your membership to receive',
    button: 'Verify my account',
    published: 'Verification panel published.',
    guild: 'Verification requires an available server.',
    screening: 'Accept the server rules before requesting your role.',
    stale: 'Use this server’s current verification panel.',
    missing: 'Staff need to configure a participant role with /verification.',
    verified: 'Verification complete. Your role is',
  },
} as const;
export function verificationCopy(locale: string): (typeof messages)[keyof typeof messages] {
  return messages[locale.startsWith('en') ? 'en-US' : 'pt-BR'];
}
