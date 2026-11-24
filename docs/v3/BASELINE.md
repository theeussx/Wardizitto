# Baseline local

**Checkout inicial** `feat/Wardizitto-3.0.0`, `afc6500`, árvore limpa.  
**Runtime** Node.js 22.23.5 e npm 10.9.9. Nenhum `AGENTS.md` no checkout. Foram aplicadas as instruções do workspace fornecidas pelo desenvolvedor.

| Comando                  | Resultado no checkout inicial                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`                 | Aprovado                                                                                                                             |
| `npm run lint`           | Aprovado                                                                                                                             |
| `npm run format:check`   | Aprovado                                                                                                                             |
| `npm run typecheck`      | Aprovado                                                                                                                             |
| `npm test`               | 27 testes aprovados em 7 arquivos                                                                                                    |
| `npm run test:coverage`  | Aprovado. Seleção de arquivos centrais em `vitest.config.mts`.                                                                       |
| `npm run build`          | Aprovado                                                                                                                             |
| `npm run check:commands` | Aprovado                                                                                                                             |
| `npm run validate`       | Iniciou depois de edição concorrente e falhou no lint de um arquivo novo. Os scripts constituintes foram executados individualmente. |
| `npm audit`              | 20 pacotes sinalizados, dos quais 7 de gravidade alta e 13 moderada.                                                                 |
| Docker                   | CLI disponível. Daemon indisponível para o build de container local.                                                                 |

O histórico de produto está em [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md). A mudança de mantenedor e licença em `afc6500` sucede a reconstrução de `f08917b`. A tag `v2` aponta para `7496685`.

O MariaDB 10.11.14 usado para regressões é um processo local descartável criado para esta verificação. Testes criam schemas temporários com prefixo `ward_test_` e os removem após execução. Homologação depende de aplicação, guild e banco descartável separados. Nenhuma credencial de produção foi usada.
