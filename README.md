# Orlando 2026

App web com autenticacao (email/senha e Google OAuth) e pagina protegida para acesso ao conteudo principal.

Deploy: sem deploy publico no momento.

## Demo

- Screenshots/GIF (adicione em `docs/` e atualize os links abaixo):
  - `docs/login.png`
  - `docs/register.png`
  - `docs/orlando.png`
- Video curto (opcional): (adicione o link aqui)

## Features

- Login com email/senha (JWT em cookie HTTP-only)
- Tela de login baseada no template Skote (UI fiel)
- Cadastro, logout e perfil do usuario
- Recuperacao de senha (token por log em dev)
- Login social via Google OAuth
- Pagina protegida `orlando.html`
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
- Dados locais: `data/app.db`

Diagrama simples:

```
[Browser] -> [Express API + Static] -> [SQLite data/app.db]
```

## Requisitos

- Node.js 18+ (recomendado)
- NPM
- Conta Google OAuth (para login Google)

## Como rodar local

```bash
npm install
# crie o .env com as variaveis abaixo
npm start
```

URLs locais:

- http://localhost:3000/login
- http://localhost:3000/register
- http://localhost:3000/forgot
- http://localhost:3000/reset
- http://localhost:3000/orlando.html (protegida)

## Configuracao de ambiente (.env)

Crie um arquivo `.env` na raiz do projeto.

Tabela de variaveis:

| Variavel | Exemplo | Descricao |
| --- | --- | --- |
| PORT | 3000 | Porta do servidor (default 3000) |
| NODE_ENV | production | Habilita modo prod (cookies `secure`) |
| JWT_SECRET | troque-este-segredo | Segredo para assinar JWT (obrigatorio em prod) |
| ALLOWED_ORIGINS | http://localhost:3000 | Origens permitidas (CSV) |
| GOOGLE_CLIENT_ID | xxx.apps.googleusercontent.com | OAuth client id do Google |
| GOOGLE_CLIENT_SECRET | xxxxx | OAuth client secret do Google |
| GOOGLE_REDIRECT_URI | http://localhost:3000/api/auth/google/callback | Callback do Google (obrigatorio em prod) |
| SEED_EMAIL | admin@exemplo.com | Usuario inicial (opcional, so se DB vazia) |
| SEED_PASSWORD | senha-forte | Senha do usuario inicial |

Exemplo `.env` (nao use segredos reais aqui):

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
ALLOWED_ORIGINS=http://localhost:3000
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SEED_EMAIL=admin@exemplo.com
SEED_PASSWORD=senha-forte-123
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

Principais endpoints:

- `POST /login` { `email`, `password` }
- `POST /register` { `email`, `password` }
- `POST /logout`
- `GET /me`
- `POST /forgot` { `email` }
- `POST /reset` { `token`, `password` }
- `GET /auth/google`
- `GET /auth/google/callback`

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
2. Garanta escrita em `data/` para o SQLite.
3. `npm ci --omit=dev`
4. `node server.js` (idealmente via PM2/systemd).
5. Monitore logs em stdout/stderr.

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
