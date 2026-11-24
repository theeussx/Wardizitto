import { discordTheme } from '../core/design/discord-theme.js';
import type { Locale } from '../core/localization/translator.js';
import type { GuildConfiguration } from '../modules/configuration/application/guild-configuration.js';
import type { DiscordGuild } from './discord-oauth.js';
import type { Session } from './session-store.js';

const messages = {
  'pt-BR': {
    skip: 'Ir para o conteúdo',
    title: 'Gerencie sua comunidade.',
    introduction:
      'Configure o idioma do Wardizitto no servidor. A preferência também fica disponível em /config no Discord.',
    login: 'Entrar com Discord',
    open: 'Abrir painel',
    dashboard: 'Painel',
    logout: 'Sair',
    servers: 'Seus servidores',
    serversHelp: 'Selecione um servidor para editar suas configurações.',
    empty: 'Nenhum servidor disponível',
    emptyHelp:
      'O Wardizitto precisa estar no servidor, e você precisa ter a permissão Gerenciar Servidor.',
    settings: 'Configurações do servidor',
    locale: 'Idioma do bot',
    localeHelp: 'Escolha o idioma das interfaces compatíveis do Wardizitto neste servidor.',
    save: 'Salvar idioma',
    saved: 'Idioma salvo.',
    retry: 'Voltar ao início',
    errors: {
      accessDenied: 'Não foi possível autorizar esta ação. Abra o painel e tente novamente.',
      discordUnavailable: 'O Discord está indisponível no momento. Tente novamente em instantes.',
      invalidRequest: 'A solicitação contém informações inválidas.',
      largeBody: 'A solicitação ultrapassa o tamanho permitido.',
      loginRequired: 'Sua sessão expirou. Entre com o Discord para continuar.',
      notFound: 'Esta página ou servidor está indisponível.',
      oauthFailed: 'O login com Discord foi interrompido. Inicie o login novamente.',
      rateLimit: 'Há muitas solicitações no momento. Aguarde um minuto e tente novamente.',
      revisionConflict:
        'Esta configuração mudou enquanto a página estava aberta. Volte ao painel e revise as alterações.',
      serverError: 'Não consegui concluir esta operação. Tente novamente.',
      unsupportedBody: 'O formato enviado não é compatível com esta operação.',
    },
  },
  'en-US': {
    skip: 'Skip to content',
    title: 'Manage your community.',
    introduction:
      'Set your server’s Wardizitto language. The same preference is available in /config on Discord.',
    login: 'Sign in with Discord',
    open: 'Open dashboard',
    dashboard: 'Dashboard',
    logout: 'Sign out',
    servers: 'Your servers',
    serversHelp: 'Select a server to edit its settings.',
    empty: 'No servers available',
    emptyHelp: 'Wardizitto must be in the server, and you need the Manage Server permission.',
    settings: 'Server settings',
    locale: 'Bot language',
    localeHelp: 'Choose the language of supported Wardizitto interfaces in this server.',
    save: 'Save language',
    saved: 'Language saved.',
    retry: 'Back to home',
    errors: {
      accessDenied: 'We couldn’t authorize this action. Open the dashboard and try again.',
      discordUnavailable: 'Discord is currently unavailable. Try again in a moment.',
      invalidRequest: 'The request contains invalid information.',
      largeBody: 'The request exceeds the allowed size.',
      loginRequired: 'Your session expired. Sign in with Discord to continue.',
      notFound: 'This page or server is unavailable.',
      oauthFailed: 'Sign-in with Discord was interrupted. Start signing in again.',
      rateLimit: 'There are too many requests right now. Wait one minute and try again.',
      revisionConflict:
        'This setting changed while the page was open. Return to the dashboard and review the changes.',
      serverError: 'We couldn’t complete this action. Try again.',
      unsupportedBody: 'The submitted format is unsupported for this action.',
    },
  },
} as const;

export type ErrorCode = keyof (typeof messages)['pt-BR']['errors'];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(locale: Locale, title: string, content: string, session?: Session): string {
  const text = messages[locale];
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Wardizitto</title>
<link rel="stylesheet" href="/assets/dashboard.css">
</head>
<body>
<a class="skip" href="#main">${text.skip}</a>
<header><div class="inner top">
<a class="brand" href="/"><span class="mark" aria-hidden="true">W</span>Wardizitto</a>
${session ? `<nav aria-label="${text.dashboard}"><a href="/dashboard">${text.dashboard}</a><form action="/logout" method="post"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><button class="quiet" type="submit">${text.logout}</button></form></nav>` : ''}
</div></header>
<main class="inner" id="main">${content}</main>
</body>
</html>`;
}

export function homePage(locale: Locale, authenticated: boolean): string {
  const text = messages[locale];
  return layout(
    locale,
    'Wardizitto',
    `<section class="intro"><h1>${text.title}</h1><p>${text.introduction}</p>
${authenticated ? `<a class="action" href="/dashboard">${text.open}</a>` : `<form action="/oauth/discord" method="post"><button class="action" type="submit">${text.login}</button></form>`}</section>`,
  );
}

export function guildListPage(session: Session, guilds: DiscordGuild[]): string {
  const text = messages[session.locale];
  const list = guilds
    .map(
      ({ id, name }) =>
        `<li><a href="/dashboard/guilds/${id}"><span>${escapeHtml(name)}</span><span aria-hidden="true">→</span></a></li>`,
    )
    .join('');
  return layout(
    session.locale,
    text.servers,
    `<h1>${text.servers}</h1><p>${text.serversHelp}</p>
${guilds.length ? `<ul class="servers">${list}</ul>` : `<section class="empty"><h2>${text.empty}</h2><p>${text.emptyHelp}</p></section>`}`,
    session,
  );
}

export function guildPage(
  session: Session,
  guild: DiscordGuild,
  settings: GuildConfiguration,
  saved: boolean,
): string {
  const text = messages[session.locale];
  return layout(
    session.locale,
    guild.name,
    `<a class="back" href="/dashboard"><span aria-hidden="true">←</span> ${text.servers}</a>
<h1>${escapeHtml(guild.name)}</h1>
<section class="settings">
<h2>${text.settings}</h2>
${saved ? `<p class="status" role="status">${text.saved}</p>` : ''}
<form action="/dashboard/guilds/${guild.id}" method="post">
<label for="locale">${text.locale}</label>
<p id="locale-help">${text.localeHelp}</p>
<select id="locale" name="locale" aria-describedby="locale-help">
<option lang="pt-BR"${settings.locale === 'pt-BR' ? ' selected' : ''} value="pt-BR">Português (Brasil)</option>
<option lang="en-US"${settings.locale === 'en-US' ? ' selected' : ''} value="en-US">English (US)</option>
</select>
<input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}">
<input type="hidden" name="revision" value="${settings.revision}">
<button class="action" type="submit">${text.save}</button>
</form>
</section>`,
    session,
  );
}

export function errorPage(locale: Locale, code: ErrorCode): string {
  const text = messages[locale];
  return layout(
    locale,
    'Wardizitto',
    `<section class="intro"><h1>${text.errors[code]}</h1><a class="action" href="/">${text.retry}</a></section>`,
  );
}

export const stylesheet = `
:root {
  color-scheme: dark;
  --background: #090d16;
  --surface: #111827;
  --border: #34445d;
  --text: #f1f5f9;
  --muted: #a8b6ca;
  --primary: #${discordTheme.primary.toString(16).padStart(6, '0')};
  --focus: #93c5fd;
  --ink: #07101f;
  background: var(--background);
  color: var(--text);
  font: 1rem/1.5 system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; }
a { color: var(--focus); text-underline-offset: .2em; }
a, button, select { touch-action: manipulation; }
:focus-visible { outline: .18rem solid var(--focus); outline-offset: .2rem; }
button, select { font: inherit; }
button { cursor: pointer; }
input, select { min-width: 0; }
.inner { margin-inline: auto; width: min(100% - 2.5rem, 62rem); }
header { border-bottom: 1px solid var(--border); }
.top, .brand, nav { display: flex; align-items: center; }
.top { min-height: 4.25rem; justify-content: space-between; gap: 1rem; padding-block: .5rem; flex-wrap: wrap; }
.brand { gap: .55rem; color: var(--text); font-weight: 700; text-decoration: none; }
.mark { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border: 1px solid var(--primary); color: var(--focus); border-radius: .375rem; }
nav { gap: 1rem; }
nav a, .quiet { display: inline-flex; min-height: 2.75rem; align-items: center; }
main { padding-block: clamp(2rem, 7vw, 5rem); }
h1, h2, p { margin: 0; }
h1, h2, .servers span { overflow-wrap: anywhere; }
h1 { max-width: 20ch; font-size: clamp(2rem, 7vw, 3.75rem); line-height: 1.09; letter-spacing: -.04em; }
h2 { font-size: 1.2rem; }
p { margin-top: .75rem; max-width: 55ch; color: var(--muted); }
.intro { border-left: .25rem solid var(--primary); padding-inline-start: clamp(1rem, 5vw, 2.5rem); }
.action { display: inline-flex; min-height: 2.75rem; align-items: center; margin-top: 1.5rem; padding: .625rem 1rem; border: 0; border-radius: .375rem; background: var(--primary); color: var(--ink); font-weight: 700; text-decoration: none; }
.action:hover { background: var(--focus); }
.quiet { color: var(--text); background: transparent; border: 1px solid var(--border); border-radius: .375rem; padding-inline: .7rem; white-space: nowrap; }
.servers { padding: 0; margin-top: 2rem; max-width: 42rem; border-block: 1px solid var(--border); list-style: none; }
.servers li + li { border-top: 1px solid var(--border); }
.servers a { display: flex; gap: 1rem; justify-content: space-between; padding: 1rem .75rem; text-decoration: none; }
.servers a:hover, .quiet:hover { background: var(--surface); }
.empty, .settings { max-width: 42rem; margin-top: 2rem; padding: clamp(1rem, 4vw, 2rem); border: 1px solid var(--border); border-radius: .5rem; background: var(--surface); }
.back { display: inline-block; margin-bottom: 1rem; }
.settings form { margin-top: 1.25rem; }
.settings label { display: block; font-weight: 700; }
.settings select { display: block; min-height: 2.75rem; max-width: 100%; margin-top: .75rem; padding: .5rem; border: 1px solid var(--border); border-radius: .375rem; background: var(--background); color: var(--text); }
.status { color: #86efac; }
.skip { position: fixed; inset: .5rem auto auto .5rem; padding: .5rem; background: var(--background); }
.skip:not(:focus) { clip-path: inset(50%); }
`;
