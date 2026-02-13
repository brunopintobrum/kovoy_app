# PLANO COMPLETO DE REVISAO - Orlando 2026

> Gerado em 2026-02-08 apos auditoria completa de backend, frontend, testes, docs e issues.

---

## RESUMO EXECUTIVO

- **55 endpoints** no backend, **25 tabelas** no banco
- **11 paginas HTML**, **11 arquivos JS** core no frontend
- **35+ testes unitarios**, **2 testes E2E** (cobertura ~15%)
- **16 issues** existentes no GitHub (#3 a #18)
- **3 vulnerabilidades CRITICAS** de seguranca encontradas
- **85% do codigo frontend** e lixo do template Bootstrap (nao usado)
- **Zero framework de i18n**, acessibilidade parcial
- **4 listas duplicadas** de "atualizacoes recentes" nos docs

---

## SECAO A: VULNERABILIDADES CRITICAS DE SEGURANCA

> Estas devem ser corrigidas ANTES de qualquer outra tarefa.

### A1. [SECURITY] Corrigir autorizacao ausente em 17 endpoints de dados

**Problema:** Endpoints de POST/PUT/DELETE para families, participants, expenses, flights, lodgings, transports e tickets verificam apenas `requireGroupMember` mas NAO `requireGroupRole(EDITOR_ROLES)`. Resultado: usuarios com role `viewer` podem criar, editar e deletar dados.

**Sub-tasks:**
- [ ] A1.1 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de families (server.js:2302, 2319, 2342)
- [ ] A1.2 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de participants (server.js:2410, 2440, 2475)
- [ ] A1.3 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de expenses (server.js:2813, 2853, 2899)
- [ ] A1.4 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de flights (server.js:3023, 3112, 3212)
- [ ] A1.5 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de lodgings (server.js:3295, 3366, 3451)
- [ ] A1.6 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de transports (server.js:3486, 3540, 3608)
- [ ] A1.7 Adicionar `requireGroupRole(EDITOR_ROLES)` em POST/PUT/DELETE de tickets (server.js:3650, 3717, 3799)
- [ ] A1.8 Adicionar `requireGroupRole(ADMIN_ROLES)` em POST /api/invitations (server.js:3886)
- [ ] A1.9 Testes para verificar que viewer NAO consegue modificar dados
- [ ] A1.10 Testes para verificar que member consegue modificar dados

### A2. [SECURITY] Corrigir bug req.groupRole nunca atribuido

**Problema:** `requireGroupMember` (server.js:2113-2130) nao define `req.groupRole`. Resultado: owner pode sair do grupo (server.js:2246 verifica `req.groupRole === 'owner'` que e sempre undefined), criando grupos orfaos.

**Sub-tasks:**
- [ ] A2.1 Adicionar `req.groupRole = member.role;` em requireGroupMember (server.js:2127)
- [ ] A2.2 Teste: owner NAO consegue sair do grupo
- [ ] A2.3 Teste: member consegue sair do grupo

### A3. [SECURITY] Corrigir vulnerabilidades XSS no frontend

**Problema:** `groups.js` usa `innerHTML` com nomes de grupos/participantes sem sanitizar. Ataque: nome de grupo `<img src=x onerror=alert('XSS')>` executa JavaScript.

**Sub-tasks:**
- [ ] A3.1 Substituir `innerHTML` por `textContent` + `createElement` em groups.js (linhas 213, 249+)
- [ ] A3.2 Substituir `innerHTML` por `textContent` em group.js para nomes de participantes, familias, despesas
- [ ] A3.3 Sanitizar todos os campos de texto antes de inserir no DOM
- [ ] A3.4 (Opcional) Adicionar DOMPurify como dependencia de sanitizacao
- [ ] A3.5 Testes E2E com caracteres especiais em nomes de grupo/participante

### A4. [SECURITY] Fixes menores de seguranca

**Sub-tasks:**
- [ ] A4.1 Usar `authRequiredApi` em GET /api/me (server.js:1620) em vez de validacao manual
- [ ] A4.2 Adicionar `requireCsrfToken` em POST /api/logout (server.js:1610)
- [ ] A4.3 Hash de invitation tokens (atualmente plaintext, server.js:231)
- [ ] A4.4 Autenticar GET /api/invitations/:token/info (server.js:3970) ou hash do token
- [ ] A4.5 Rate limiting em endpoints de dados (POST/PUT/DELETE expenses, flights, etc.)

---

## SECAO B: ISSUES EXISTENTES DECOMPOSTAS EM SUB-TASKS

### B1. Issue #5 - Deploy em producao (HIGH)

**Sub-tasks:**
- [ ] B1.1 Escolher plataforma (Render vs Railway vs Fly.io vs VPS)
- [ ] B1.2 Criar Dockerfile ou configuracao de deploy
- [ ] B1.3 Configurar variaveis de ambiente em producao
- [ ] B1.4 Configurar banco SQLite persistente (volume)
- [ ] B1.5 Configurar dominio customizado (opcional)
- [ ] B1.6 Configurar HTTPS/SSL
- [ ] B1.7 Testar todas as funcionalidades em producao
- [ ] B1.8 Configurar monitoramento basico (health check)
- [ ] B1.9 Atualizar README com URL de producao
- [ ] B1.10 Configurar backup automatico do SQLite

### B2. Issue #6 - Sistema de anexos e recibos (MEDIUM)

**Sub-tasks:**
- [ ] B2.1 Schema: tabela `attachments` (id, entity_type, entity_id, filename, mime, size, path, uploaded_by, created_at)
- [ ] B2.2 Configurar storage (local em /uploads ou S3)
- [ ] B2.3 Endpoint POST /api/groups/:groupId/attachments (upload com Multer)
- [ ] B2.4 Endpoint GET /api/groups/:groupId/attachments/:id (download/preview)
- [ ] B2.5 Endpoint DELETE /api/groups/:groupId/attachments/:id
- [ ] B2.6 Validacao: tipo de arquivo (jpg, png, pdf), tamanho max 5MB
- [ ] B2.7 Validacao server-side: magic bytes (nao confiar so na extensao)
- [ ] B2.8 UI: botao de upload em cada modulo (expenses, flights, lodgings, etc.)
- [ ] B2.9 UI: preview inline (imagens) e link (PDFs)
- [ ] B2.10 UI: lista de anexos com delete
- [ ] B2.11 Testes unitarios para upload/validacao
- [ ] B2.12 Testes E2E para fluxo de upload

### B3. Issue #7 - Categorias avancadas e filtros (MEDIUM)

**Sub-tasks:**
- [ ] B3.1 Schema: tabela `categories` (id, group_id, name, parent_id, color, icon)
- [ ] B3.2 Endpoint CRUD /api/groups/:groupId/categories
- [ ] B3.3 Vincular categorias a expenses (campo category_id em expenses)
- [ ] B3.4 UI: gerenciamento de categorias (criar, editar, deletar, sub-categorias)
- [ ] B3.5 UI: filtros combinados no painel (por categoria, payer, data, valor)
- [ ] B3.6 UI: salvar filtros favoritos (localStorage)
- [ ] B3.7 UI: exportar resultados filtrados (CSV)
- [ ] B3.8 Testes

### B4. Issue #8 - Multi-moeda e cambio por data (MEDIUM)

**Sub-tasks:**
- [ ] B4.1 Integrar API de cambio (exchangerate-api.com ou similar)
- [ ] B4.2 Schema: tabela `exchange_rates` (from, to, rate, date, source)
- [ ] B4.3 Cache de taxas (evitar chamadas repetidas)
- [ ] B4.4 Endpoint GET /api/exchange-rate?from=USD&to=BRL&date=2026-01-15
- [ ] B4.5 Logica de conversao automatica no calculo de saldos
- [ ] B4.6 Fallback para taxa manual quando API indisponivel
- [ ] B4.7 UI: exibir valor original + valor convertido na moeda do grupo
- [ ] B4.8 UI: campo de moeda em cada despesa (ja existe mas usar melhor)
- [ ] B4.9 UI: config de moeda padrao do grupo (ja existe)
- [ ] B4.10 Testes

### B5. Issue #9 - Timeline do grupo e notificacoes (MEDIUM)

**Sub-tasks:**
- [ ] B5.1 Schema: tabela `activity_log` (id, group_id, user_id, action, entity_type, entity_id, details_json, created_at)
- [ ] B5.2 Middleware de auditoria para capturar acoes automaticamente
- [ ] B5.3 Endpoint GET /api/groups/:groupId/activity (com paginacao e filtros)
- [ ] B5.4 UI: timeline de atividades no dashboard do grupo
- [ ] B5.5 Schema: tabela `notifications` (id, user_id, group_id, type, message, read_at, created_at)
- [ ] B5.6 Endpoint GET /api/notifications (lista) e PUT /api/notifications/:id/read
- [ ] B5.7 UI: icone de notificacoes no header com badge de contagem
- [ ] B5.8 UI: dropdown de notificacoes
- [ ] B5.9 (Opcional) Email notifications para acoes criticas
- [ ] B5.10 Testes

### B6. Issue #10 - Import/Export CSV/JSON (MEDIUM)

**Sub-tasks:**
- [ ] B6.1 Endpoint GET /api/groups/:groupId/export/csv (expenses)
- [ ] B6.2 Endpoint GET /api/groups/:groupId/export/json (grupo completo)
- [ ] B6.3 UI: botoes de export no painel
- [ ] B6.4 Endpoint POST /api/groups/:groupId/import/csv (expenses)
- [ ] B6.5 Logica de validacao e parsing de CSV
- [ ] B6.6 UI: upload de CSV com preview antes de confirmar
- [ ] B6.7 UI: tratamento de erros (linhas invalidas, campos faltando)
- [ ] B6.8 Documentar formato CSV esperado
- [ ] B6.9 Testes

### B7. Issue #11 - Auditoria de alteracoes (MEDIUM)

> **NOTA:** Compartilha schema com B5 (Timeline). A tabela `activity_log` deve servir ambos.

**Sub-tasks:**
- [ ] B7.1 Capturar valores antes/depois (diff) nas operacoes de UPDATE
- [ ] B7.2 Endpoint GET /api/groups/:groupId/audit-log (com filtros por user, entity, date)
- [ ] B7.3 UI: pagina de audit log com filtros
- [ ] B7.4 Retencao configuravel (limpar logs antigos)
- [ ] B7.5 Permissoes: apenas owner e admin veem o audit log
- [ ] B7.6 Testes

### B8. Issue #12 - Ampliar cobertura de testes E2E (LOW)

**Sub-tasks:**
- [ ] B8.1 E2E: fluxo completo de hospedagens (CRUD)
- [ ] B8.2 E2E: fluxo completo de transportes (CRUD)
- [ ] B8.3 E2E: fluxo completo de tickets (CRUD)
- [ ] B8.4 E2E: fluxo de convites (criar, aceitar, expirar)
- [ ] B8.5 E2E: fluxo de recuperacao de senha
- [ ] B8.6 E2E: fluxo de perfil (avatar upload, editar nome)
- [ ] B8.7 E2E: fluxo de roles (viewer nao pode editar, member pode)
- [ ] B8.8 E2E: fluxo de saldo familiar vs individual
- [ ] B8.9 Configurar coverage report no CI
- [ ] B8.10 Alvo: >80% cobertura

### B9. Issue #13 - Testes de seguranca (LOW)

**Sub-tasks:**
- [ ] B9.1 Testes de SQL injection em todos os campos de input
- [ ] B9.2 Testes de XSS (stored e reflected)
- [ ] B9.3 Testes de CSRF (endpoints sem token devem falhar)
- [ ] B9.4 Testes de autorizacao (viewer nao pode editar)
- [ ] B9.5 Testes de rate limiting (exceder limite retorna 429)
- [ ] B9.6 npm audit no CI pipeline
- [ ] B9.7 Documentar praticas de seguranca em SECURITY.md

### B10. Issue #14 - Adicionar ESLint ao CI (LOW)

**Sub-tasks:**
- [ ] B10.1 Instalar ESLint e dependencias
- [ ] B10.2 Criar .eslintrc.js com regras (Airbnb ou Standard)
- [ ] B10.3 Script `npm run lint` no package.json
- [ ] B10.4 Step de lint no CI (antes dos testes)
- [ ] B10.5 Corrigir erros existentes (ou configurar ignore progressivo)
- [ ] B10.6 (Opcional) Prettier para formatacao

### B11. Issue #15 - Logs estruturados (LOW)

**Sub-tasks:**
- [ ] B11.1 Instalar Winston ou Pino
- [ ] B11.2 Configurar logger com niveis (debug, info, warn, error)
- [ ] B11.3 Formato JSON em producao, human-readable em dev
- [ ] B11.4 Substituir todos os console.log/warn/error por logger
- [ ] B11.5 Log de HTTP requests (middleware de request logging)
- [ ] B11.6 Log de erros com stack trace
- [ ] B11.7 Configuracao por ambiente (LOG_LEVEL env var)
- [ ] B11.8 (Opcional) Integrar com Sentry para error tracking

### B12. Issue #16 - Metricas de performance (LOW)

**Sub-tasks:**
- [ ] B12.1 Endpoint GET /health (status, uptime, memory)
- [ ] B12.2 Middleware de timing (tempo de resposta por endpoint)
- [ ] B12.3 Metricas de memoria e CPU
- [ ] B12.4 (Opcional) Prometheus endpoint /metrics
- [ ] B12.5 (Opcional) Grafana dashboard

### B13. Issue #17 - CHANGELOG.md (LOW)

**Sub-tasks:**
- [ ] B13.1 Criar CHANGELOG.md com formato Keep a Changelog
- [ ] B13.2 Retrospectiva: documentar versoes passadas
- [ ] B13.3 Consolidar as 4 listas de "atualizacoes recentes" numa so
- [ ] B13.4 Remover duplicatas de CONTEXT.md, AGENTS.md, docs/README.md

### B14. Issue #18 - Configurar Dependabot (LOW)

**Sub-tasks:**
- [ ] B14.1 Criar .github/dependabot.yml
- [ ] B14.2 Configurar ecosystem npm, schedule semanal
- [ ] B14.3 Grouping de patches
- [ ] B14.4 (Opcional) Auto-merge para patches com CI verde

---

## SECAO C: NOVAS ISSUES IDENTIFICADAS (lacunas nao mapeadas)

### C1. [CRITICAL] Error handling global no backend

**Problema:** Nao existe `app.use((err, req, res, next))` nem `process.on('unhandledRejection')`. 20+ endpoints sem try-catch. SQLite BUSY errors podem crashar o app.

**Sub-tasks:**
- [ ] C1.1 Adicionar global error handler no Express
- [ ] C1.2 Adicionar process.on('unhandledRejection') e process.on('uncaughtException')
- [ ] C1.3 Wrap de try-catch em todos os endpoints de dados (families, participants, expenses, flights, lodgings, transports, tickets)
- [ ] C1.4 Resposta consistente de erro 500 com mensagem generica
- [ ] C1.5 Log de erros (console.error por agora, logger depois)

### C2. [HIGH] Paginacao em endpoints de lista

**Problema:** GET de expenses, flights, lodgings, etc. retornam TODOS os registros. Com muitos dados, performance degrada.

**Sub-tasks:**
- [ ] C2.1 Adicionar query params `?page=1&limit=20` em GET /api/groups/:groupId/expenses
- [ ] C2.2 Mesmo para flights, lodgings, transports, tickets
- [ ] C2.3 Response com metadata: `{ data: [...], total, page, limit, pages }`
- [ ] C2.4 UI: paginacao ou infinite scroll
- [ ] C2.5 Testes

### C3. [HIGH] Validacao de input ausente

**Problema:** Varios campos nao tem validacao de tamanho/formato no backend.

**Sub-tasks:**
- [ ] C3.1 Max length em group.name (ex: 100 chars)
- [ ] C3.2 Max length em family.name (ex: 80 chars)
- [ ] C3.3 Max length em participant.display_name (ex: 80 chars)
- [ ] C3.4 Max length em expense.description (ex: 500 chars)
- [ ] C3.5 Max length em notes de flights/lodgings/transports/tickets (ex: 1000 chars)
- [ ] C3.6 Validacao de currency contra lista permitida (ISO 4217)
- [ ] C3.7 Validacao de amounts (nao negativo, max razoavel)
- [ ] C3.8 Sanitizacao de strings (trim, remover caracteres de controle)

### C4. [HIGH] Remover codigo morto do template Bootstrap

**Problema:** ~85% dos arquivos em public/assets/ sao do template Skote e nunca usados. Aumenta tamanho do repo e confunde.

**Sub-tasks:**
- [ ] C4.1 Inventariar arquivos realmente usados (HTML imports, JS/CSS refs)
- [ ] C4.2 Remover JS nao usado em public/assets/js/pages/ (~50 arquivos)
- [ ] C4.3 Remover libs nao usadas em public/assets/libs/ (~15 diretorios)
- [ ] C4.4 Remover CSS nao usado (RTL, dark variants nao usados)
- [ ] C4.5 Verificar que nada quebrou apos remocao
- [ ] C4.6 Testes E2E para confirmar

### C5. [MEDIUM] Acessibilidade (a11y)

**Sub-tasks:**
- [ ] C5.1 Adicionar alt text em todas as imagens (logos, avatars)
- [ ] C5.2 Adicionar aria-label em botoes icon-only (hamburger, settings)
- [ ] C5.3 Adicionar scope em headers de tabela
- [ ] C5.4 Substituir `<a href="javascript:void(0)">` por `<button>`
- [ ] C5.5 Adicionar skip-to-content link
- [ ] C5.6 Melhorar focus indicators (outline visivel)
- [ ] C5.7 Keyboard trap em modais
- [ ] C5.8 Testar com screen reader (NVDA/VoiceOver)

### C6. [MEDIUM] Internacionalizacao (i18n)

**Sub-tasks:**
- [ ] C6.1 Escolher framework (i18next recomendado para vanilla JS)
- [ ] C6.2 Extrair todas as strings hardcoded para arquivo de traducao
- [ ] C6.3 Criar traducao en-US (default)
- [ ] C6.4 Criar traducao pt-BR
- [ ] C6.5 UI: seletor de idioma
- [ ] C6.6 Formatacao de datas/numeros por locale (Intl API)
- [ ] C6.7 Resolver mistura portugues/ingles no codigo (app.js labels)

### C7. [MEDIUM] Melhorias de UX no frontend

**Sub-tasks:**
- [ ] C7.1 Loading states (skeleton) para todas as listas
- [ ] C7.2 Empty states significativos (icone + mensagem + CTA)
- [ ] C7.3 Confirmacao antes de delete (modal, nao window.confirm)
- [ ] C7.4 Toast de sucesso/erro consistente em todas as paginas
- [ ] C7.5 Preservar estado do formulario em caso de erro de validacao
- [ ] C7.6 Busca/filtro em listas grandes (participants, expenses)
- [ ] C7.7 Sorting por coluna nas tabelas de dados

### C8. [MEDIUM] Completar funcionalidades V2 dos modulos

**Problema:** Itens listados em docs/MVP.md como pendentes.

**Sub-tasks:**
- [ ] C8.1 Voos: prefilling por airline + flight number
- [ ] C8.2 Voos: UX filtros por cia/rota/status
- [ ] C8.3 Transportes: autocomplete para origem/destino
- [ ] C8.4 Tickets: autocomplete para local
- [ ] C8.5 Hospedagens: contato como campo obrigatorio (validar)

### C9. [MEDIUM] Limpar tabelas legadas

**Problema:** Tabelas legacy (trips, trip_flights, etc.) ainda existem no schema mas nao sao usadas.

**Sub-tasks:**
- [ ] C9.1 Confirmar que nenhum endpoint usa as tabelas legacy
- [ ] C9.2 Adicionar migration para DROP das tabelas legacy
- [ ] C9.3 Remover references no SCHEMA.md e CONTEXT.md
- [ ] C9.4 Testar que nada quebra

### C10. [LOW] Criar documentacao faltante

**Sub-tasks:**
- [ ] C10.1 Criar LICENSE (MIT recomendado)
- [ ] C10.2 Criar SECURITY.md (politica de vulnerabilidades)
- [ ] C10.3 Criar CONTRIBUTING.md (referenciando GIT_WORKFLOW.md)
- [ ] C10.4 Criar docs/API.md (documentacao dedicada da API com exemplos)
- [ ] C10.5 Criar docs/ARCHITECTURE.md (diagrama e decisoes)
- [ ] C10.6 Atualizar docs/SCHEMA.md (potencialmente desatualizado)
- [ ] C10.7 Atualizar docs/MVP.md (reconciliar checkboxes inconsistentes)

### C11. [LOW] Melhorias de performance do backend

**Sub-tasks:**
- [ ] C11.1 Adicionar indices em colunas frequentemente filtradas
- [ ] C11.2 Otimizar queries com JOINs (evitar N+1)
- [ ] C11.3 Compressao de resposta (gzip middleware)
- [ ] C11.4 Cache de dados de referencia (airlines, airports, countries)
- [ ] C11.5 ETag/Last-Modified headers para caching HTTP

### C12. [LOW] Migrar default branch no GitHub (master -> main)

**Problema:** Remote default branch ainda aparece como `master`. PRs vao apontar para `master` por default.

**Sub-tasks:**
- [ ] C12.1 Alterar default branch no GitHub Settings
- [ ] C12.2 Deletar branch remota `master`
- [ ] C12.3 Atualizar CI badge se necessario
- [ ] C12.4 Marcar checklist em PROXIMOS_PASSOS_MIGRACAO.md
- [ ] C12.5 Arquivar docs de migracao (RENAME_MASTER_TO_MAIN.md, PROXIMOS_PASSOS_MIGRACAO.md)

---

## SECAO D: RESUMO DE ISSUES A CRIAR NO GITHUB

### Quantidade total

| Categoria | Qtd Issues | Prioridade |
|-----------|-----------|------------|
| Security fixes (A1-A4) | 4 | CRITICAL |
| Error handling (C1) | 1 | CRITICAL |
| Input validation (C3) | 1 | HIGH |
| Paginacao (C2) | 1 | HIGH |
| Codigo morto (C4) | 1 | HIGH |
| Deploy (B1 = #5) | ja existe | HIGH |
| Anexos (B2 = #6) | ja existe | MEDIUM |
| Categorias (B3 = #7) | ja existe | MEDIUM |
| Multi-moeda (B4 = #8) | ja existe | MEDIUM |
| Timeline (B5 = #9) | ja existe | MEDIUM |
| Import/Export (B6 = #10) | ja existe | MEDIUM |
| Auditoria (B7 = #11) | ja existe | MEDIUM |
| Acessibilidade (C5) | 1 | MEDIUM |
| i18n (C6) | 1 | MEDIUM |
| UX melhorias (C7) | 1 | MEDIUM |
| V2 modulos (C8) | 1 | MEDIUM |
| Legacy cleanup (C9) | 1 | MEDIUM |
| Testes E2E (B8 = #12) | ja existe | LOW |
| Testes seguranca (B9 = #13) | ja existe | LOW |
| ESLint (B10 = #14) | ja existe | LOW |
| Logs (B11 = #15) | ja existe | LOW |
| Metricas (B12 = #16) | ja existe | LOW |
| CHANGELOG (B13 = #17) | ja existe | LOW |
| Dependabot (B14 = #18) | ja existe | LOW |
| Docs faltantes (C10) | 1 | LOW |
| Performance (C11) | 1 | LOW |
| Branch migration (C12) | 1 | LOW |

**Total: 16 issues existentes + 14 novas = 30 issues**
**Total de sub-tasks: ~160**

### Ordem recomendada de execucao

```
FASE 1 - SEGURANCA (1-2 dias)
  A1 Autorizacao em endpoints
  A2 Bug req.groupRole
  A3 XSS no frontend
  A4 Fixes menores de seguranca
  C1 Error handling global

FASE 2 - QUALIDADE (1-2 dias)
  C3 Validacao de input
  C12 Branch migration
  C4 Remover codigo morto
  B10 ESLint

FASE 3 - INFRAESTRUTURA (2-3 dias)
  B1 Deploy em producao
  B14 Dependabot
  B11 Logs estruturados
  B12 Metricas/health check

FASE 4 - FEATURES MEDIUM (2-3 semanas)
  C2 Paginacao
  C7 Melhorias UX
  B3 Categorias e filtros
  B6 Import/Export CSV
  B4 Multi-moeda
  B2 Anexos e recibos
  B5/B7 Timeline + Auditoria (compartilham schema)
  C8 V2 modulos

FASE 5 - POLISH (1-2 semanas)
  C5 Acessibilidade
  C6 i18n
  B8 Testes E2E
  B9 Testes seguranca
  C9 Legacy cleanup
  C10 Documentacao
  B13 CHANGELOG
  C11 Performance
```
