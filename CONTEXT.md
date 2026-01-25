# Project Context

## Overview
- App web para organizar viagens em grupo (Orlando 2026), com cadastro/login (email/senha e Google OAuth) e painel protegido por grupo.
- Usuario final: equipe/familia planejando viagem, com foco em cadastro simples e seguranca basica.

## Scope
- In scope: autenticacao, verificacao de email, two-factor por email, grupos, convites, familias, participantes, despesas e dashboard de saldos.
- Out of scope (por enquanto): deploy publico, pagamentos, integracoes externas alem de Google OAuth, app mobile.

## Architecture
- Monolito Node.js + Express servindo API e arquivos estaticos.
- Banco local SQLite via better-sqlite3 (`data/app.db` ou `DB_PATH`).
- Autenticacao com JWT em cookie HTTP-only + refresh tokens.
- Seguranca: Helmet, rate limit, CSRF para operacoes de escrita.

## Data Model
- users: id, email, password_hash, google_sub, first_name, last_name, display_name, avatar_url, email_verified_at, two_factor_enabled, created_at.
- tokens: refresh_tokens, email_verification_tokens, reset_tokens, two_factor_codes.
- grupos: groups, group_members, invitations, families, participants, expenses, expense_splits, group_flights, group_flight_participants, group_lodgings, group_transports, group_tickets.
- lookup: airlines, airports.
- legado: trips, trip_flights, trip_lodgings, trip_cars, trip_expenses, trip_transports, trip_timeline, trip_reminders.
- campos V2 (grupo): group_transports inclui origin, destination, depart_at, arrive_at, provider, locator, status, expense_id.
- campos V2 (grupo): group_tickets inclui type, event_at, location, status, expense_id e tabela group_ticket_participants.

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
- Caminho do template: `D:\ChatGPT\Skote_Asp.net_v3.2.0\Skote Asp.net Core\Skote`.
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
- Licenca, observabilidade e politicas de contribuicao.

## Atualizacoes recentes
- Dependencias de upload e email atualizadas: multer 2.x e nodemailer 7.x.
- `npm audit fix --force` aplicado para zerar vulnerabilidades.
- `npm test` executado com sucesso.
- Playwright E2E e pipeline CI adicionados.
- E2E atualizado para fluxo de grupos e webserver dedicado.
- Fluxo de grupos no painel fechado com validacoes e convites.
- Validacao da soma do split e testes de convites adicionados.
- Despesas: edicao no painel (UI).
- Split manual de despesas implementado (V1.1).
- API de modulos por grupo (voos, hospedagens, transportes, tickets) adicionada.
- CRUD no dashboard para voos, hospedagens, transportes e tickets.
- Base V2: modulos aceitam vinculo opcional de despesa (expense_id).
- UI: toggle para vincular despesas nos modulos (V2 opcional).
- Financeiro do MVP concentrado em Expenses; modulos V2 sao logísticos.
- Voos V2: novos campos (flight number, class, status), assentos/bagagens por passageiro via vinculo a participantes, e autocomplete de aeroportos (From/To).
- Voos V2: chegada sincroniza com a partida no formulario.
- Testes: validacoes e integracao para voos V2.
- Schema: tabela group_flight_participants para vinculo de passageiros nos voos.
- Voos V2 (proximos): validar chegada > partida, exibir classe/assento/bagagem na lista, seletor de passageiros com busca.
- Voos V2: campo Airline agora usa autocomplete/datalist alimentado pela tabela `airlines`, registra o `airline_id` e cria novas companhias automaticamente para manter consistência.
- Hospedagens V2: endereco completo + contato, quartos, check-in/out com hora e status.
- Schema: novos campos em group_lodgings para endereco, horarios, quartos e status.
- Hospedagens V2: backend valida check-out posterior ao check-in.
- Transportes V2: origem/destino, datas/horas, fornecedor/localizador, status e observacoes.
- Transportes V2: validacao de chegada posterior a partida no backend.
- Transportes V2: UI valida chegada posterior a partida.
- Schema: novos campos em group_transports para origem/destino, datas/horas, fornecedor/localizador e status.
- Testes: validacao de transportes V2.
- Modulos V2 sincronizam o pagador e o split (participants/families/manual) do painel diretamente na despesa vinculada, usando `expense_splits` para registrar cada alvo.
- Tickets V2: tipo, data/hora, local, status e vinculo a participantes.
- Schema: novos campos em group_tickets e tabela group_ticket_participants.
- Testes: validacao de tickets V2.
- Tickets V2: backend valida data/hora futura quando status=planned.
- Hospedagens V2: UI valida check-out posterior ao check-in.
- Tickets V2: UI valida data/hora futura quando status=planned.

