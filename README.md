# Wardizitto v2

<div align="center">
  <img src="Wardizitto.png" alt="Wardizitto" width="420">
  <p><strong>Bot Discord modular para administração, economia, moderação e comunidades.</strong></p>
  <p>
    <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white">
    <img alt="Discord.js 14" src="https://img.shields.io/badge/Discord.js-14-5865F2?logo=discord&logoColor=white">
    <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
    <img alt="License AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
  </p>
</div>

## Visão geral

A versão 2 reconstrói o runtime do Wardizitto sobre uma composição explícita, TypeScript estrito, módulos funcionais e fronteiras inspiradas em Clean Architecture. Configuração, banco, logs, permissões, rate limiting, tratamento de erros e roteamento do Discord são serviços centralizados e testáveis.

O projeto contém somente o bot Discord. Não há API HTTP ou dashboard web nesta versão; camadas vazias não foram criadas apenas para aparentar complexidade.

## Funcionalidades

- comandos slash e comandos legados por prefixo, carregados por registry validado;
- moderação com hierarquia, advertências, timeout, expulsão e banimento;
- tickets configuráveis com garantia de apenas um ticket aberto por usuário;
- economia com operações financeiras atômicas e histórico transacional;
- casamento isolado por servidor e protegido contra vínculos concorrentes;
- verificação, AFK, utilidades, jogos, fanarts e relatórios de bugs;
- integrações opcionais com Groq e VirusTotal;
- cooldown por comando e rate limit global por usuário;
- logs estruturados, coloridos, separados por categoria e rotacionados diariamente;
- migrations versionadas com lock distribuído e verificação de checksum;
- encerramento gracioso e tratamento global de falhas.

## Requisitos

- Node.js **22.22.1 ou superior**;
- npm 10 ou superior;
- MySQL 8.0+;
- aplicação Discord com os intents habilitados conforme a configuração.

## Instalação

```bash
git clone https://github.com/theeussx/Wardizitto.git
cd Wardizitto
nvm use
npm ci
cp .env.example .env
```

Preencha ao menos `DISCORD_TOKEN`, `DISCORD_OWNER_IDS`, `DISCORD_GUILD_ID` e as variáveis `DB_*`. Nunca versione `.env`.

```bash
npm run db:migrate
npm run dev
```

Para produção:

```bash
npm run validate
npm run start:prod
```

### Docker

```bash
cp .env.example .env
# configure também MYSQL_ROOT_PASSWORD no ambiente

docker compose up --build -d
```

O processo executa migrations na inicialização quando `DB_MIGRATE_ON_START=true`.

## Configuração

Todas as variáveis e defaults estão documentados em [`.env.example`](.env.example). Destaques:

| Variável                              | Finalidade                                               |
| ------------------------------------- | -------------------------------------------------------- |
| `DISCORD_OWNER_IDS`                   | Lista de owners separada por vírgula                     |
| `DISCORD_GLOBAL_COMMANDS`             | Registra globalmente; em desenvolvimento prefira `false` |
| `DISCORD_GUILD_ID`                    | Guild usada no registro local                            |
| `DB_MIGRATE_ON_START`                 | Aplica migrations pendentes antes do login               |
| `LOG_LEVEL` / `LOG_RETENTION_DAYS`    | Verbosidade e retenção dos logs                          |
| `COMMAND_COOLDOWN_MS`                 | Cooldown padrão por comando/usuário                      |
| `RATE_LIMIT_*`                        | Proteção global contra abuso                             |
| `HTTP_*`                              | Timeout e limite de respostas externas                   |
| `GROQ_API_KEY` / `VIRUSTOTAL_API_KEY` | Integrações opcionais                                    |

A aplicação falha cedo com uma lista clara de campos inválidos. Secrets nunca são incluídos nos logs.

## Scripts

| Comando                  | Ação                                             |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Executa em desenvolvimento com reload            |
| `npm run build`          | Compila TypeScript e copia assets versionados    |
| `npm start`              | Executa o build de produção                      |
| `npm run db:migrate`     | Aplica migrations pendentes                      |
| `npm run check:commands` | Valida contratos, nomes e duplicatas de comandos |
| `npm run lint`           | Executa ESLint                                   |
| `npm run format:check`   | Valida Prettier                                  |
| `npm run typecheck`      | Valida tipos sem gerar build                     |
| `npm test`               | Executa testes                                   |
| `npm run test:coverage`  | Testes com limites mínimos de cobertura          |
| `npm run validate`       | Executa todos os quality gates                   |

## Estrutura

```text
src/
├── application/              # casos de uso, portas e serviços de aplicação
├── core/                     # configuração, erros, localização e segurança
├── infrastructure/           # MySQL, migrations, cache, HTTP, logs e integrações
├── modules/                  # módulos funcionais independentes
│   ├── economy/
│   ├── moderation/
│   ├── social/
│   ├── tickets/
│   └── ...
├── presentation/discord/     # client, routers, registries e lifecycle
└── main.ts                   # composition root
```

O fluxo é `Discord → router → middleware → serviço de aplicação → porta → infraestrutura`. Regras de negócio não devem depender de builders ou interações do Discord.

Leia:

- [Arquitetura](docs/ARCHITECTURE.md)
- [Banco de dados](docs/DATABASE.md)
- [Migração da v1](docs/MIGRATION_V2.md)
- [Segurança](SECURITY.md)
- [Contribuição](CONTRIBUTING.md)

## Qualidade e CI/CD

Os quality gates estão disponíveis por `npm run validate`. Templates de CI, migrations em MySQL e publicação no GHCR ficam em `docs/workflows/`; copie-os para `.github/workflows/` quando a integração GitHub tiver permissão de Workflows/Actions.

Commits seguem [Conventional Commits](https://www.conventionalcommits.org/) e são validados por Commitlint. Husky e lint-staged verificam arquivos alterados antes do commit.

## Licença

Wardizitto é distribuído sob [AGPL-3.0-only](LICENSE).
