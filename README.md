# Orlando 2026

App web com autenticacao (email/senha e Google OAuth) e painel protegido para organizar a viagem (voos, hospedagens, carros, despesas, transportes, timeline e lembretes).

Deploy: sem deploy publico no momento.

## Demo

- Screenshots/GIF (adicione em `docs/` e atualize os links abaixo):
  - `docs/login.png`
  - `docs/register.png`
  - `docs/orlando.png`
- Video curto (opcional): (adicione o link aqui)

## Features

- Login com email/senha (JWT em cookie HTTP-only)
- Verificacao de email (opcional por config)
- Two-factor por email (opcional por config)
- Refresh tokens e expiracao configuravel
- Tela de login baseada no template Kovoy (UI fiel)
- Cadastro com email, primeiro nome, sobrenome, senha e confirmacao de senha
- Logout, perfil e recuperacao de senha
- Login social via Google OAuth
- Foto do usuario via Google (campo `avatar_url`)
- Painel protegido `orlando.html` com dados da viagem
- CRUD completo de viagem: voos, hospedagens, carros, despesas, transportes, timeline e lembretes
- Protecao CSRF para operacoes de escrita
- Rate limiting e headers de seguranca

### Roadmap

- Envio real de email para reset de senha
- Testes automatizados (unit/integration/e2e)
- CI/CD basico com lint/test/build
- Observabilidade (logs estruturados/metrics)

## Stack e arquitetura

- Node.js + Express
- SQLite (better-sqlite3)
- Auth: JWT em cookie + Google OAuth
- Seguranca: Helmet, rate limit
- Arquitetura: monolito simples (API + static files no mesmo servidor)
- Dados locais: `data/app.db` (ou `DB_PATH`)

Diagrama simples:

```
[Browser] -> [Express API + Static] -> [SQLite data/app.db]
```

## Banco de dados

Schema criado automaticamente no boot. Tabelas principais:

- `users`, `refresh_tokens`, `email_verification_tokens`, `reset_tokens`, `two_factor_codes`
- `trips`, `trip_flights`, `trip_lodgings`, `trip_cars`
- `trip_expenses`, `trip_transports`, `trip_timeline`, `trip_reminders`

Campos relevantes em `users`:

- `email`, `password_hash`, `google_sub`
- `first_name`, `last_name`, `display_name`, `avatar_url`
- `email_verified_at`, `two_factor_enabled`, `created_at`

## Requisitos

- Node.js 18+ (recomendado)
- NPM
- Conta Google OAuth (para login Google)

## Como rodar local

```bash
npm install
# crie o .env a partir do .env.example
npm start
```

URLs locais:

- http://localhost:3000/login
- http://localhost:3000/register
- http://localhost:3000/forgot
- http://localhost:3000/reset
- http://localhost:3000/orlando.html (protegida)

## Configuracao de ambiente (.env)

Crie um arquivo `.env` na raiz do projeto. Para producao, use o modelo `/.env.production.example` e preencha os valores reais em um `.env.production`.

Tabela de variaveis:

| Variavel | Exemplo | Descricao |
| --- | --- | --- |
| PORT | 3000 | Porta do servidor (default 3000) |
| NODE_ENV | production | Habilita modo prod (cookies `secure`) |
| DB_PATH | data/app.db | Caminho do SQLite (default `data/app.db`) |
| JWT_SECRET | troque-este-segredo | Segredo para assinar JWT (obrigatorio em prod) |
| ALLOWED_ORIGINS | http://localhost:3000 | Origens permitidas (CSV) |
| APP_BASE_URL | http://localhost:3000 | Base URL usada em emails/links |
| GOOGLE_CLIENT_ID | xxx.apps.googleusercontent.com | OAuth client id do Google |
| GOOGLE_CLIENT_SECRET | xxxxx | OAuth client secret do Google |
| GOOGLE_REDIRECT_URI | http://localhost:3000/api/auth/google/callback | Callback do Google (obrigatorio em prod) |
| SEED_EMAIL | admin@exemplo.com | Usuario inicial (opcional, so se DB vazia) |
| SEED_PASSWORD | senha-forte | Senha do usuario inicial |
| SMTP_HOST | smtp.exemplo.com | Host SMTP (se vazio, email nao eh enviado) |
| SMTP_PORT | 587 | Porta SMTP |
| SMTP_USER | usuario | Usuario SMTP |
| SMTP_PASS | senha | Senha SMTP |
| SMTP_SECURE | false | TLS/SSL (true/false) |
| SMTP_FROM | no-reply@exemplo.com | Remetente dos emails |
| EMAIL_VERIFICATION_REQUIRED | true | Exige confirmacao de email |
| EMAIL_TOKEN_TTL_MINUTES | 60 | TTL do token de email |
| TWO_FACTOR_REQUIRED | false | Exige two-factor por email |
| TWO_FACTOR_TTL_MINUTES | 10 | TTL do codigo de two-factor |
| TWO_FACTOR_ATTEMPT_LIMIT | 5 | Tentativas maximas do two-factor |
| RESET_TOKEN_TTL_MINUTES | 30 | TTL do token de reset |
| ACCESS_TOKEN_TTL_MINUTES | 30 | TTL do access token |
| REFRESH_TOKEN_TTL_DAYS_SESSION | 1 | TTL do refresh token (sessao) |
| REFRESH_TOKEN_TTL_DAYS_REMEMBER | 30 | TTL do refresh token (lembrar) |

Exemplo `.env` (nao use segredos reais aqui):

```env
PORT=3000
NODE_ENV=development
DB_PATH=data/app.db
JWT_SECRET=change-me
ALLOWED_ORIGINS=http://localhost:3000
APP_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SEED_EMAIL=admin@exemplo.com
SEED_PASSWORD=senha-forte-123
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_SECURE=false
SMTP_FROM=nao-responder@exemplo.com
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_TOKEN_TTL_MINUTES=60
TWO_FACTOR_REQUIRED=false
TWO_FACTOR_TTL_MINUTES=10
TWO_FACTOR_ATTEMPT_LIMIT=5
RESET_TOKEN_TTL_MINUTES=30
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS_SESSION=1
REFRESH_TOKEN_TTL_DAYS_REMEMBER=30
```

## Scripts/Comandos uteis

- `npm start`: inicia o servidor (`node server.js`)

## Testes

Suite de testes com Jest.

Rodar testes:

```bash
npm test
```

No Windows, se houver travamento, use:

```bash
npm test -- --runInBand
```

Sugestao de padrao:

- Unit: autenticacao, tokens e validacoes
- Integration: rotas `/api/*`
- E2E: fluxo login/cadastro/reset

## Documentacao da API

Base: `http://localhost:3000/api`

Auth:

- Cookie HTTP-only `auth_token` com JWT
- Para POST/PUT/DELETE, enviar header `x-csrf-token` com o valor do cookie `csrf_token`

Principais endpoints:

- `POST /login` { `email`, `password` }
- `POST /register` { `email`, `firstName`, `lastName`, `password`, `confirmPassword` }
- `POST /logout`
- `GET /me`
- `POST /forgot` { `email` }
- `POST /reset` { `token`, `password` }
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /trip`
- `POST /trip`
- `GET /trip/meta`
- `PUT /trip/meta`
- `GET /trip/flights`
- `POST /trip/flights`
- `PUT /trip/flights/:id`
- `DELETE /trip/flights/:id`
- `GET /trip/lodgings`
- `POST /trip/lodgings`
- `PUT /trip/lodgings/:id`
- `DELETE /trip/lodgings/:id`
- `GET /trip/cars`
- `POST /trip/cars`
- `PUT /trip/cars/:id`
- `DELETE /trip/cars/:id`
- `GET /trip/expenses`
- `POST /trip/expenses`
- `PUT /trip/expenses/:id`
- `DELETE /trip/expenses/:id`
- `GET /trip/transports`
- `POST /trip/transports`
- `PUT /trip/transports/:id`
- `DELETE /trip/transports/:id`
- `GET /trip/timeline`
- `POST /trip/timeline`
- `PUT /trip/timeline/:id`
- `DELETE /trip/timeline/:id`
- `GET /trip/reminders`
- `POST /trip/reminders`
- `PUT /trip/reminders/:id`
- `DELETE /trip/reminders/:id`

Exemplo rapido:

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@exemplo.com","password":"senha-forte"}'
```

Resposta:

```json
{"ok": true}
```

## Deploy

Passos sugeridos (ajuste conforme sua plataforma):

1. Configure as variaveis de ambiente (principalmente `JWT_SECRET`, `ALLOWED_ORIGINS`, `GOOGLE_*`).
2. Garanta escrita em `data/` para o SQLite (ou ajuste `DB_PATH`).
3. `npm ci --omit=dev`
4. `node server.js` (idealmente via PM2/systemd).
5. Monitore logs em stdout/stderr.

Checklist de producao:

- `NODE_ENV=production` e `APP_BASE_URL` com o dominio correto
- `ALLOWED_ORIGINS` restrito ao(s) dominio(s) reais
- `JWT_SECRET` forte e rotacionado periodicamente
- `DB_PATH` absoluto com backup e permissao de escrita
- SMTP configurado e testado (envio de emails)
- `SEED_EMAIL`/`SEED_PASSWORD` removidos apos o bootstrap

## CI/CD

Pipeline ainda nao definido. Sugestao:

- Lint + testes
- Build (se existir)
- Deploy automatico

## Contribuicao

Sem politica formal no momento. Sugestao:

- Branches: `feature/`, `fix/`
- Commits: Conventional Commits
- PR com descricao e passos de teste

## Versionamento e changelog

Nao definido. Sugestao: SemVer + `CHANGELOG.md`.

## Seguranca

- Nao commite `.env`.
- Para reportar vulnerabilidade: abrir issue privada ou contato direto (a definir).

## Licenca

Nao definida. Adicione um `LICENSE` quando decidir.

## Creditos / autores / contato

Mantenedor: Bruno Pinto Brum
Contato: brunobrum@gmail.com | +1 (514) 926-9447 (Canada)

## Atualizacoes recentes

- Dependencias de upload e email atualizadas: multer 2.x e nodemailer 7.x.
- `npm audit fix --force` aplicado para zerar vulnerabilidades.
- `npm test` executado com sucesso.

