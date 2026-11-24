# Banco de dados

## Estratégia

MySQL é acessado por um pool único criado no composition root. O pool não abre conexão nem executa DDL durante importação. Uma falha de transporte pode ocorrer depois da confirmação no servidor. O driver envia cada operação uma vez. Uma nova tentativa exige que o chamador conheça a idempotência da operação.

## Migrations

Arquivos em `src/infrastructure/database/migrations` seguem `NNN_nome.sql`. O runner:

- reserva uma conexão e adquire `GET_LOCK('wardizitto:migrations')`;
- cria `schema_migrations` sob o lock;
- valida SHA-256 de migrations já aplicadas;
- executa statements separados por `-- migrate:split`;
- registra a migration somente após sucesso;
- valida e libera o lock na mesma conexão. Uma conexão em estado incerto é descartada.

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

## Economia e compatibilidade da v3

Carteira, banco, XP e profissão pertencem ao usuário em todos os servidores. O inventário permanece associado ao usuário e à guild de compra. A economia conserva os campos BIGINT existentes. Transferências usam uma ordem estável desde o primeiro bloqueio de conta e registram as duas pontas da movimentação na mesma transação. O recibo de uma transferência nova conserva os saldos de carteira e banco. Em recibos anteriores à v3, o banco consultado em um replay reflete o saldo bancário atual.

As alterações de saldo feitas pelo serviço registram a carteira resultante em `balance_after` e o banco em `metadata.bank`. Em ajustes administrativos do banco, `amount` representa a variação do banco. Em depósitos e saques representa a variação da carteira. Compras incluem a guild no lançamento. O histórico financeiro anterior à atualização conserva sua cobertura original. O ganho de XP em trabalho e jogos volta a aplicar a regra de `659155e`: cada ação premiada pode avançar um nível, consome o nível anterior multiplicado por 500 em XP e credita o novo nível multiplicado por 1.000 em Wardcoins.

### Integração descartável

Use uma instância local exclusiva de teste. Disponibilize um usuário com permissão para criar e remover bancos no prefixo `ward_test_`. Os testes criam um nome aleatório em cada suíte e removem somente esse banco ao terminar. A configuração da aplicação é independente. Com o serviço ativo em loopback:

```sh
WARD_TEST_MYSQL_PORT=3306 WARD_TEST_MYSQL_USER=ward_test \
  WARD_TEST_MYSQL_PASSWORD="$TEST_PASSWORD" npm test
```

Sem a porta explícita, os testes de integração aparecem como ignorados. A validação local dessa onda usou MariaDB 10.11 com InnoDB. O MySQL 8.4 do Compose requer uma execução própria antes da homologação.

Novos recibos de ajustes, depósitos, saques e compras registram a solicitação original e os saldos após a operação. Reentregas com a mesma conta, operação, guild e argumentos retornam o primeiro resultado, inclusive quando o preço ou nome do item mudou. A opção “tudo” é resolvida sob o bloqueio da conta. Um identificador já utilizado com argumentos diferentes, ou sem metadados suficientes para conferência, é rejeitado. Apostas com movimentação deduplicam o lançamento e o XP por transação. Seus comandos ainda sorteiam a jogada em memória, e o resultado visual de uma aposta anterior e os empates não possuem recibo persistente.
