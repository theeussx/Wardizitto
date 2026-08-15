# Política de segurança

## Relatando uma vulnerabilidade

Não publique tokens, dados pessoais, exploits ou detalhes de uma vulnerabilidade em issues públicas. Use o recurso **Security Advisories** do GitHub para um relato privado, incluindo impacto, passos mínimos de reprodução e versão afetada.

## Secrets

- use `.env` ou o secret manager da plataforma;
- nunca envie token Discord, senha MySQL, API keys, webhook ou dados Pix ao Git;
- rotacione imediatamente qualquer segredo exposto;
- logs estruturados não devem receber objetos de configuração completos.

## Modelo de confiança

Dados de interações, componentes, attachments, APIs e banco são considerados não confiáveis. Handlers devem validar tipo, tamanho, guild, usuário autorizado, hierarquia de cargos e permissões do bot.

Downloads externos passam por timeout, limite de bytes, HTTPS, allowlist quando aplicável, resolução DNS e bloqueio de redes privadas. Operações administrativas geram audit log.

## Dependências

A CI executa `npm audit --audit-level=high`. Atualizações devem preservar o lockfile e passar por todos os quality gates. Pacotes nativos desnecessários e duplicados não devem ser adicionados.

## Suporte

Apenas a linha v2 recebe correções de segurança. Não há garantia de correção retroativa para forks com alterações não publicadas.
