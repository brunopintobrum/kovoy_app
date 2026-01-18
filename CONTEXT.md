# Project Context

## Overview
- App web para organizar a viagem Orlando 2026, com cadastro/login (email/senha e Google OAuth) e painel protegido.
- Usuario final: equipe/familia planejando viagem, com foco em cadastro simples e seguranca basica.

## Scope
- In scope: autenticacao, verificacao de email, two-factor por email, painel protegido e CRUD de viagem.
- Out of scope (por enquanto): deploy publico, pagamentos, integracoes externas alem de Google OAuth, app mobile.

## Architecture
- Monolito Node.js + Express servindo API e arquivos estaticos.
- Banco local SQLite via better-sqlite3 (`data/app.db` ou `DB_PATH`).
- Autenticacao com JWT em cookie HTTP-only + refresh tokens.
- Seguranca: Helmet, rate limit, CSRF para operacoes de escrita.

## Data Model
- users: id, email, password_hash, google_sub, first_name, last_name, display_name, avatar_url, email_verified_at, two_factor_enabled, created_at.
- tokens: refresh_tokens, email_verification_tokens, reset_tokens, two_factor_codes.
- viagem: trips, trip_flights, trip_lodgings, trip_cars, trip_expenses, trip_transports, trip_timeline, trip_reminders.

## Auth & Security
- Register/login via `/api/register` e `/api/login`.
- Email verification opcional por `EMAIL_VERIFICATION_REQUIRED`.
- Two-factor por email opcional por `TWO_FACTOR_REQUIRED` ou flag do usuario.
- Google OAuth com scope `openid email profile`, mapeando `given_name` e `family_name` para `first_name` e `last_name`, e `picture` para `avatar_url`.
- CSRF: header `x-csrf-token` deve bater com cookie `csrf_token` em operacoes de escrita.
- Regras de senha no cadastro: minimo 9 caracteres, 1 maiuscula, 1 minuscula, 1 numero, 1 especial.

## UI/UX Guidelines
- UI baseada no template Skote; manter consistencia visual.
- Cadastro deve conter: email, first name, last name, password e confirm password.
- O template Skote (ASP.NET Core) e a fonte da verdade para UI/UX, estruturas, componentes e nomenclaturas.

## Conventions
- Backend principal em `server.js`.
- Frontend em `public/*.html` e `public/*.js`.
- Colunas de banco em snake_case.

## Skote Template (Regra Absoluta)
- Caminho do template: `F:\OneDrive\PCTECH\Skote_Asp.net_v3.2.0\Skote Asp.net Core\Skote`.
- Antes de qualquer implementacao: analisar estrutura, Controllers/Views/ViewModels/Services, layouts, componentes, CSS/JS, validacoes e mensagens.
- Replicar organizacao de pastas e padroes visuais/estruturais do Skote no projeto atual.
- Nao criar estruturas novas se ja existir equivalente no Skote; nao mudar nomenclaturas sem justificativa tecnica.
- Se algo nao existir no Skote: solucao mais simples, alinhada ao visual/arquitetura, com comentario curto justificando.
- Validar antes de entregar: consistencia visual com Skote e padroes de codigo.

## Operations
- Local: `npm start` (porta default 3000).
- Variaveis de ambiente em `.env`/`.env.production` conforme README.
- Sem deploy publico definido.

## Open Decisions
- CI/CD, licenca, observabilidade e politicas de contribuicao.
