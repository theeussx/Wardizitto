# Contribuindo

## Ambiente

```bash
nvm use
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

## Fluxo

1. Abra uma issue para mudanças relevantes.
2. Crie uma branch curta e focada.
3. Implemente sem violar a direção de dependências descrita em `docs/ARCHITECTURE.md`.
4. Adicione ou atualize testes.
5. Execute `npm run validate`.
6. Abra um pull request explicando comportamento, riscos, migrations e rollback operacional.

## Padrões

- TypeScript estrito para código novo.
- Sem `any`; valide dados externos na fronteira.
- Não acesse `process.env` fora do config loader.
- Não use SQL em novos comandos; crie um serviço/repositório.
- Não adicione listener próprio para `interactionCreate`.
- Não registre IDs de Discord, tokens, webhooks ou dados pessoais no código.
- Use transação para invariantes que envolvam mais de uma consulta.
- Evite abstrações sem consumidor real.

## Commits

Use Conventional Commits:

```text
feat(economy): add atomic marketplace purchase
fix(tickets): enforce one open ticket per member
docs: explain migration backup
```

Husky executa lint-staged e Commitlint localmente.

## Definition of Done

- comportamento documentado;
- permissões e entradas validadas;
- erros operacionais amigáveis;
- logs sem secrets;
- testes relevantes;
- migrations progressivas quando houver schema;
- `npm run validate` verde.
