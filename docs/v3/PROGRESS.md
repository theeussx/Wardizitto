# Wardizitto 3.0 — Progresso

Estado: em desenvolvimento. Checkout inicial limpo em `feat/Wardizitto-3.0.0`, commit `afc6500`. Nenhuma operação em produção foi executada.

## Baseline

Node 22.23.5 e npm 10.9.9. `npm run lint`, `format:check`, `typecheck`, `test`, `test:coverage`, `build` e `check:commands` passaram individualmente. A suíte original executou 27 testes em 7 arquivos. A cobertura informada pelo Vitest é restrita aos arquivos configurados, não representa cobertura do produto inteiro. `validate` iniciou após a criação concorrente de arquivos novos e falhou em lint de um deles. Deve ser executado novamente no resultado integrado. Docker está instalado, mas seu daemon não estava disponível.

## Backlog inicial

| ID     | Prioridade | Área         | Evidência e aceitação                                                                                                                | Estado                         |
| ------ | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| V3-001 | P0         | Banco        | Escritas repetidas após falha ambígua em `mysql-database.ts`. Garantir que escritas não sejam repetidas implicitamente e testar.     | Em andamento                   |
| V3-002 | P0         | Migrations   | `GET_LOCK` e `RELEASE_LOCK` usam pool e podem usar sessões diferentes. Garantir posse durante toda a execução e testar concorrência. | Em andamento                   |
| V3-003 | P0         | Tickets      | Abertura e claim possuem riscos de concorrência e inconsistência. Testar com banco descartável e falhas externas.                    | Em andamento                   |
| V3-004 | P1         | Moderação    | Prefixos ban/kick e `/cargo` não verificavam hierarquia do executor. Acrescentar verificações e testes.                              | Implementado, revisão pendente |
| V3-005 | P1         | Configuração | Implementar configuração persistida e interface Discord com autorização revalidada.                                                  | Em andamento                   |
| V3-006 | P1         | IA           | `/criar-servidor` executa alterações geradas por IA sem prévia e contém limpeza destrutiva. Revisar antes de disponibilizar.         | Pendente                       |
| V3-007 | P1         | Produto      | Dashboard, OAuth, internacionalização integral, módulos e homologação externa previstos na missão.                                   | Pendente                       |
| V3-008 | P1         | Qualidade    | Cobertura configurada exclui a maioria dos módulos e serviços críticos. Ampliar testes por invariantes.                              | Pendente                       |

## Histórico e arquitetura

O histórico local possui 28 commits, incluindo reconstrução modular em `f08917b` e versões anteriores com economia, perfis e tickets. O projeto atual mantém comandos JavaScript, MySQL e registries TypeScript. A investigação de funcionalidades históricas e suas classificações ainda está incompleta. Não há evidência suficiente para trocar o banco ou reorganizar o repositório neste estágio.

## Próximos passos

Concluir e revisar as alterações em andamento, rodar `npm run validate`, testar migrations e concorrência em banco descartável, e registrar evidências e limitações. Seguir as ondas da missão até cumprir os critérios aplicáveis. Homologação Discord real depende de ambiente de staging disponibilizado pelo desenvolvedor.
