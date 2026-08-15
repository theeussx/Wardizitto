# Changelog

Todas as mudanças relevantes seguem [Keep a Changelog](https://keepachangelog.com/) e versionamento semântico.

## [2.0.0] - 2026-08-15

### Adicionado

- runtime TypeScript estrito e arquitetura modular em camadas;
- config loader validado, `.env.example` e mensagens de diagnóstico;
- logger estruturado com categorias, cores, arquivos e rotação diária;
- migrations versionadas, checksum e lock distribuído;
- serviços transacionais de economia e casamento;
- permissões centralizadas, cooldown, rate limit, métricas e tratamento global de erros;
- testes com cobertura mínima, ESLint, Prettier, Husky, Commitlint e lint-staged;
- templates de CI com MySQL real, auditoria, build de container e release para GHCR;
- documentação de arquitetura, banco, segurança, migração e contribuição.

### Alterado

- comandos e componentes foram reorganizados por módulo;
- todos os componentes persistentes usam um único router;
- intents Discord foram reduzidos ao necessário;
- tickets, AFK e casamentos agora respeitam escopo de guild;
- economia crítica usa locks e transações atômicas;
- integrações HTTP usam timeout e limites.

### Removido

- listeners duplicados e eventos inválidos;
- comandos duplicados ou simulados;
- comando de remoção arbitrária de tabelas;
- SQLite versionado com extensão `.json` e histórico de doações com dados pessoais;
- dependências de áudio, mídia e utilidades sem uso.
