# Banco de dados

## Estratégia

MySQL é acessado por um pool único criado no composition root. O pool não abre conexão nem executa DDL durante importação. Consultas transitórias recebem retry exponencial apenas para códigos seguros; transações nunca são repetidas automaticamente.

## Migrations

Arquivos em `src/infrastructure/database/migrations` seguem `NNN_nome.sql`. O runner:

- cria `schema_migrations`;
- adquire `GET_LOCK('wardizitto:migrations')`;
- valida SHA-256 de migrations já aplicadas;
- executa statements separados por `-- migrate:split`;
- registra a migration somente após sucesso;
- impede alteração silenciosa do histórico.

MySQL realiza commit implícito em diversos DDLs. Por isso migrations de schema não fingem atomicidade; devem ser progressivas, idempotentes quando possível e testadas em backup.

```bash
npm run db:migrate
```

## Modelo v2

- `custom_permissions`: grants por usuário/cargo;
- `economia_usuarios`: snapshot compatível da conta;
- `economy_transactions`: ledger de operações relevantes;
- `economia_inventario`: item único por guild/usuário/item;
- `casamentos` + `marriage_members`: vínculo e garantia de um casamento por usuário/guild;
- `tickets` + coluna gerada `open_user_key`: um ticket aberto por usuário/guild;
- `warns`, `verified_users`, `afk_status`: dados isolados por guild onde aplicável;

## Concorrência

`EconomyService` usa `SELECT ... FOR UPDATE`, ordena locks em transferências e atualiza os dois saldos na mesma transação. `MarriageService` depende da chave primária `(guild_id, user_id)` em `marriage_members`. Tickets usam índice único sobre chave gerada somente quando o status é `open`.

Nunca faça leitura de saldo seguida de update fora de uma transação. Nunca construa nome de tabela/coluna com entrada de usuário.

## Backup e restore

Antes de migrar produção:

```bash
mysqldump --single-transaction --routines --triggers "$DB_NAME" > backup.sql
npm run db:migrate
```

Teste restore regularmente. Dumps, bancos locais e arquivos `.sql` fora da pasta de migrations são ignorados pelo Git.
