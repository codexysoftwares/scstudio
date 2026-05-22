# Postgres + Docker base do projeto

Esta base deixa o projeto pronto para rodar localmente com PostgreSQL e facilita a futura subida para uma VPS.

## O que foi organizado

- `docker-compose.yml`: sobe `postgres` e `app` no mesmo ambiente.
- `Dockerfile`: imagem de producao do Next.js.
- `db/init/001_initial_schema.sql`: schema inicial do sistema.
- `lib/db.ts`: pool reutilizavel de conexao.
- `lib/booking-repository.ts`: persistencia inicial dos agendamentos.
- `app/api/health/db/route.ts`: healthcheck simples do banco.

## Como usar localmente

1. Copie `.env.example` para `.env.local`.
2. Ajuste `DATABASE_URL` se quiser usar um Postgres externo.
3. Para rodar via Node local:

```bash
npm install
npm run dev
```

4. Para rodar via Docker:

```bash
docker compose up --build
```

## Banco pensado para crescer

O schema inicial ja cobre os blocos principais:

- organizacoes
- configuracoes da landing page
- usuarios internos e perfis de acesso
- profissionais
- horarios de funcionamento
- servicos
- produtos e sugestoes de venda complementar
- clientes
- agendamentos

## Comportamento atual

- Se `DATABASE_URL` estiver configurada, `POST /api/booking` grava cliente e agendamento no Postgres.
- Se `DATABASE_URL` ainda nao estiver configurada, o fluxo continua enviando notificacoes e nao quebra a landing page.

## Caminho natural dos proximos passos

1. adicionar autenticacao real para `staff_users`
2. trocar dados mockados da tela `/gestao` por leitura do banco
3. criar CRUDs de profissionais, servicos e horarios
4. criar migrations versionadas em vez de schema unico em `init`
