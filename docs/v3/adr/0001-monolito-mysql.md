# ADR 0001 — Monólito modular e MySQL na primeira etapa

**Data** 2026-11-24  
**Estado** Aceito para as primeiras ondas da v3

## Contexto

O commit `f08917b` introduziu a composição do bot em `src/application`, módulos de produto em `src/modules` e adaptadores em `src/infrastructure` e `src/presentation`. O banco contém saldos globais, casamentos, tickets, configurações e identificadores do Discord. O histórico inclui migrations para normalização de casamentos e unicidade de tickets abertos.

## Decisão

Manter a estrutura modular e o MySQL com `mysql2`. Usar serviços tipados para operações novas e migradas, com queries parametrizadas e migrations aditivas. A central Discord e o dashboard inicial consomem o mesmo serviço de configuração. Tratar a distribuição do processo, sessões compartilhadas, filas e sharding em nova decisão quando houver evidência operacional.

## Alternativas

| Alternativa                                      | Benefício                                                                        | Custo nesta etapa                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                                       | Índices parciais, JSONB, DDL transacional em mais operações e amplo ecossistema. | Adaptação de SQL, locking, schema e drivers. Exigiria transferência validada de dados históricos e rollback de cutover. |
| MariaDB como destino oficial                     | Onboarding compatível com parte do SQL atual.                                    | Divergências em JSON, SQL e operação. Usado como ambiente local adicional. O CI proposto usa MySQL 8.4.                 |
| ORM ou query builder                             | Tipagem de schema, manutenção dos contratos SQL e produtividade em CRUD.         | Reescrever queries e migrations específicas de locking, constraints e compatibilidade de dados.                         |
| Monorepo de aplicações implantadas separadamente | Escala e política de deploy por processo.                                        | Operação, autenticação entre serviços e coordenação de estado antes de haver necessidade de distribuição.               |

## Consequências

Economia e migrations continuam usando transações e locks do InnoDB. IDs do Discord permanecem strings e operações financeiras convertem inteiros conforme o contrato do serviço. A interface HTTP inicial compartilha o runtime e o serviço de configuração. Uma medição de banco ou requisito operacional que demonstre benefício suficiente poderá reabrir a avaliação do PostgreSQL.

O rollback de aplicação exige cópia de segurança prévia e validação de compatibilidade das migrations aditivas com a versão anterior. A validação MariaDB local reduz risco de regressão, e a validação em MySQL 8.4 deve anteceder o uso em staging.
