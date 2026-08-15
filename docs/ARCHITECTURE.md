# Arquitetura

## Objetivos

A arquitetura v2 prioriza fronteiras explícitas, baixo acoplamento, testabilidade e evolução incremental. Ela segue Clean Architecture de forma pragmática: abstrações existem quando protegem uma regra ou uma integração, não para preencher diretórios.

## Camadas

### `core`

Código independente de Discord e banco: validação de ambiente, erros operacionais, localização, validação de conteúdo e identidades privilegiadas.

### `domain`

Modelos e invariantes do negócio dentro de cada módulo. Exemplos: conta de economia e casamento. O domínio não importa `discord.js`, MySQL ou Winston.

### `application`

Casos de uso e portas. Serviços coordenam transações e invariantes; portas descrevem logger, banco e resolução de permissões customizadas.

### `infrastructure`

Adapters concretos: pool MySQL, migration runner, cache TTL, cliente HTTP protegido, VirusTotal e logger Winston.

### `presentation`

Adapter Discord: client, registries, routers, middlewares de permissão/cooldown/rate limit, respostas e lifecycle.

## Módulos

Cada funcionalidade vive em `src/modules/<nome>` e pode ter:

```text
domain/        regras e tipos puros
application/   casos de uso do módulo
infrastructure/adapters externos exclusivos do módulo
presentation/  comandos e componentes Discord
```

Não são criadas pastas vazias. Um módulo ganha uma nova camada apenas quando existir código com essa responsabilidade.

## Composition root

`src/main.ts` lê e valida o ambiente. `WardizittoApplication` constrói banco, serviços e client, injeta dependências e registra exatamente um listener por evento central. Nenhum módulo conecta ao banco como efeito colateral de importação.

## Fluxo de interação

1. `interactionCreate` chega ao `InteractionRouter`.
2. Rate limit global é consumido.
3. O registry resolve comando ou componente.
4. A política de acesso e o cooldown são avaliados.
5. O handler chama um serviço de aplicação quando há regra transacional.
6. Falhas passam pelo `InteractionErrorHandler` e recebem um correlation ID nos logs.
7. Duração e contadores são registrados pelo `MetricsService`.

## Registries

- comandos são encontrados recursivamente apenas em diretórios `slash` e `prefix`;
- módulos inválidos e nomes duplicados interrompem a inicialização;
- `scripts/validate-commands.mjs` valida os builders no build de CI;
- componentes persistentes usam uma tabela explícita de matchers; não há vários listeners de `interactionCreate`.

## Compatibilidade JavaScript

Os comandos históricos permanecem em JavaScript dentro de módulos, com `checkJs=false`, enquanto o runtime, serviços críticos e regras transacionais são TypeScript estrito. `infrastructure/database/legacy.ts` é uma anti-corruption layer temporária para comandos ainda não migrados a repositórios. Código novo não deve usar esse adapter.

Essa escolha preserva funcionalidades sem enfraquecer a tipagem das novas fronteiras. A remoção gradual do adapter está descrita em `MIGRATION_V2.md`.

## Decisões importantes

- CommonJS no output para compatibilidade segura com comandos existentes; TypeScript usa resolução Node16.
- MySQL continua como datastore principal; arquivos JSON mutáveis foram removidos.
- Cache é local e limitado. Estado que exige consistência entre processos permanece no MySQL.
- Operações financeiras e vínculos sociais usam transações e índices de unicidade.
- O bot usa apenas intents necessários, configuráveis quando privilegiados.
- Falhas não operacionais no processo iniciam shutdown seguro; um supervisor deve reiniciar o container.

## Como adicionar um comando

1. Escolha o módulo correto.
2. Adicione o arquivo em `presentation/discord/slash` ou `prefix`.
3. Exporte o contrato esperado pelo registry.
4. Coloque regras de negócio em um serviço de aplicação, não no builder.
5. Declare uma política `access` quando a política inferida pela categoria não for suficiente.
6. Adicione testes e execute `npm run validate`.
