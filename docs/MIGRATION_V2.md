# Migração da v1 para v2

## Mudanças obrigatórias

1. Atualize para Node.js 22.22.1+.
2. Faça backup do MySQL.
3. Renomeie variáveis:

| v1                      | v2                          |
| ----------------------- | --------------------------- |
| `DB_PASS`               | `DB_PASSWORD`               |
| `GUILD_ID`              | `DISCORD_GUILD_ID`          |
| `GLOBAL_SLASH`          | `DISCORD_GLOBAL_COMMANDS`   |
| `PREFIX`                | `DISCORD_PREFIX`            |
| owner hardcoded         | `DISCORD_OWNER_IDS`         |
| `CANAL_BUGS`            | `BUG_REPORT_CHANNEL_ID`     |
| `CANAL_FANARTS_REVISAO` | `FAN_ART_REVIEW_CHANNEL_ID` |

4. Preencha o restante a partir de `.env.example`.
5. Execute `npm ci`, `npm run db:migrate` e `npm run validate`.

## Dados

- `database.json` era um arquivo SQLite com extensão incorreta e não era usado pelo runtime; foi removido do Git.
- `doacoes.json` continha dados de usuários e escrita síncrona concorrente; foi removido. Acesso ao painel de doação agora gera audit log.
- registros AFK novos são isolados por guild. Registros antigos ficam associados à guild vazia e podem ser descartados.
- casamentos v1 não possuíam `guild_id`, portanto não podem ser atribuídos com segurança a um servidor. Eles são preservados em `casamentos`, mas apenas vínculos com guild conhecida são indexados em `marriage_members`. Usuários afetados devem refazer o vínculo no servidor correto.

## Comandos

- comandos slash que estavam incorretamente em `commands/Prefix` agora são registrados;
- o `/traduzir` simulado foi removido; permanece a integração real, limitada a cinco idiomas por chamada;
- o prefix command `clear` duplicado foi consolidado;
- duplicatas por prefixo de economia foram removidas em favor de `/daily`, `/apostar`, `/jokenpo` e `/rank`;
- `/rank` agora representa explicitamente o ranking global; a opção “servidor”, que retornava os mesmos dados globais, foi removida;
- `/gerenciar_usuário` foi normalizado para `/gerenciar-usuario`;
- o comando destrutivo de remoção arbitrária de tabelas foi removido;
- doações exigem `PIX_KEY` e `PIX_COPY_PASTE` no ambiente.

O registro local pode levar segundos para refletir mudanças. Registro global pode levar mais tempo por comportamento da API Discord.

## Deploy seguro

Execute primeiro em uma guild de teste com `DISCORD_GLOBAL_COMMANDS=false`. Depois de validar permissões, migrations, tickets e integrações, altere para registro global. Use container com política de restart para recuperação após exceções não operacionais.
