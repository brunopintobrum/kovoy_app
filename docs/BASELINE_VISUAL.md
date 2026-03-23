# Baseline Visual — Fase 1 da Refatoração Visual
> Issue: #51 | EPIC: #50 | Criado: 2026-02-17 | Atualizado: 2026-03-23

---

## 1. Inventário de Superfície Visual

### 1.1 Páginas HTML

| Página | Tipo | Rota |
|---|---|---|
| `login.html` | Auth | `/login` |
| `register.html` | Auth | `/register` |
| `forgot.html` | Auth | `/forgot` |
| `reset.html` | Auth | `/reset` |
| `confirm-mail.html` | Auth | `/confirm-mail` |
| `email-verification.html` | Auth | `/email-verification` |
| `two-step-verification.html` | Auth | `/two-step-verification` |
| `invite.html` | Auth (híbrido) | `/invite` |
| `groups.html` | App | `/groups` |
| `group.html` | App | `/dashboard` |
| `group-details.html` | App | `/group-details` |

### 1.2 CSS carregado por página

| Página | bootstrap.min.css | icons.min.css | app.min.css | auth-custom.css | groups-custom.css | dark-mode.css | CSS inline |
|---|---|---|---|---|---|---|---|
| Auth (7 páginas) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Mínimo |
| `invite.html` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 3× `font-size: 64px` |
| `groups.html` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Mínimo |
| `group.html` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Mínimo |
| `group-details.html` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Zero |

> ✅ **Atualização 2026-03-23:** Quick wins da Fase 1 aplicados (commit `ae834c2`). `groups-custom.css` agora carregado em `group.html` e `group-details.html`. Bloco `<style>` inline removido de `group-details.html` (migrado para CSS externo). Inline styles (`cursor`, `z-index`, `min-width`) migrados para classes CSS.

> ⚠️ **CSS órfão:** `/public/style.css` (1.106 linhas) contém um design system alternativo completo (CSS variables `--accent`, `--accent-2`, `--accent-3`, fontes Manrope/Fraunces, componentes `.ui-*`) mas **não é carregado por nenhuma página**. Decisão pendente: adotar como base para Fase 2 ou remover.

### 1.3 JS carregado por página

| Script | Auth pages | invite.html | groups.html | group.html | group-details.html |
|---|---|---|---|---|---|
| `jquery.min.js` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bootstrap.bundle.min.js` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `owl.carousel.min.js` | ✅ ⚠️ | ❌ | ❌ | ❌ | ❌ |
| `auth-2-carousel.init.js` | ✅ ⚠️ | ❌ | ❌ | ❌ | ❌ |
| `two-step-verification.init.js` | ✅ ⚠️ | ❌ | ❌ | ❌ | ❌ |
| `validation.init.js` | register apenas | ❌ | ❌ | ❌ | ❌ |
| `sentry-init.js` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `app.js` | ✅ | ❌ ⚠️ | ✅ | ✅ | ✅ |
| `groups.js` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `group.js` | ❌ | ❌ | ❌ | ✅ ⚠️ | ✅ ⚠️ |

> ⚠️ `owl.carousel` e `auth-2-carousel.init.js` carregados em 6 páginas de auth — nenhum deles em uso (carrossel lateral foi removido).
> ⚠️ `two-step-verification.init.js` carregado em `login.html` e `forgot.html` — irrelevante nessas páginas.
> ⚠️ `group.html` e `group-details.html` carregam o **mesmo** `group.js` — páginas distintas compartilhando um único script.
> ⚠️ `invite.html` não carrega `app.js` (sem metisMenu/sidebar — ok), mas estrutura diverge das demais.

### 1.4 Inline styles mapeados

| Arquivo | Linha(s) | Inline style | Observação |
|---|---|---|---|
| `login.html` | `<head>` 13–20 | Bloco `<style>` com `.social-list-item.is-disabled` | **Duplicado** em login e register |
| `register.html` | `<head>` 13–20 | Bloco `<style>` com `.social-list-item.is-disabled` | **Duplicado** de login.html |
| `invite.html` | 37, 48, 105 | `font-size: 64px` | 3× em ícones de estado (erro/convite/sucesso) |
| `register.html` | 110–111 | `height: 6px`, `width: 0%` | Progress bar de senha (width atualizado via JS) |
| `group.html` | 175 | `min-width: 200px` | Select groupSelector |
| `group.html` | 179 | `min-width: 220px` | Select familyBalanceMode |
| `group.html` | 361 | `z-index: 11000` | Toast container |
| `groups.html` | 276 | `z-index: 11000` | Toast container |
| `group-details.html` | 287 | `min-width: 200px` | Select groupSelector |
| `group-details.html` | 291 | `min-width: 220px` | Select familyBalanceMode |
| `group-details.html` | 472–474, 692–695, 914–920, 1170–1175, 1331–1336, 1487–1491 | `cursor: pointer` | ~20× em `<th class="sortable">` |
| `group-details.html` | 548–549 | `width: 180px`, `width: 140px` | `<th>` fixos da tabela Members |
| `group-details.html` | 1568 | `z-index: 11000` | Toast container |
| `group-details.html` | `<head>` L13–112 | Bloco `<style>` de ~100 linhas | CSS mobile-responsive para tabelas (exclusivo desta página) |

> O bloco `<style>` com CSS mobile está **apenas** em `group-details.html`. `group.html` não tem style block — usa só CSS externo.

---

## 2. Inventário de Dívida Visual (CSS)

### 2.1 Uso de `!important`

#### `groups-custom.css` — ~~21~~ → 2 ocorrências (atualizado 2026-03-23)

> ✅ **Atualização:** Refatoração da Fase 4 (commit `9775fa0`) eliminou a maioria dos `!important` deste arquivo. De 21 ocorrências, restam apenas 2.

| Seletor | Propriedade | Status |
|---|---|---|
| (2 restantes) | Verificar arquivo atual | Mantidos por necessidade de override Bootstrap |

<details>
<summary>Estado original (2026-02-17) — 21 ocorrências (histórico)</summary>

| Seletor | Propriedade | Linha aprox. |
|---|---|---|
| `.group-card` | `overflow: visible !important` | 7 |
| `.group-card:hover` | `box-shadow: ... !important` | 14 |
| `.group-card:has(.btn-group.show)` | `z-index: 10000 !important` | 21 |
| `.group-card .card-body` | `overflow: visible !important` | 26 |
| `.group-card .dropdown-menu` | `z-index: 9999 !important` | 32 |
| `.dropdown-menu` | `max-height: none !important` | 37 |
| `.dropdown-menu` | `overflow: visible !important` | 38 |
| `.dropdown-menu` | `min-width: 200px !important` | 39 |
| `.dropdown-menu` | `z-index: 9999 !important` | 40 |
| `.dropdown-menu` | `position: absolute !important` | 41 |
| `.dropdown-menu-end` | `max-height: none !important` | 45 |
| `.dropdown-menu-end` | `overflow: visible !important` | 46 |
| `.dropdown-menu-end` | `z-index: 9999 !important` | 47 |
| `.btn-group.show` | `z-index: 10000 !important` | 58 |
| `.btn-group .dropdown-menu` | `position: absolute !important` | 62 |
| `.btn-group .dropdown-menu` | `top: 100% !important` | 64 |
| `.btn-group .dropdown-menu` | `right: 0 !important` | 65 |
| `.btn-group .dropdown-menu` | `left: auto !important` | 66 |
| `.btn-group .dropdown-menu` | `z-index: 10001 !important` | 67 |
| `.dropdown-item.text-danger` | `color: #dc3545 !important` | 72 |
| `.dropdown-item.text-danger:hover` | `background-color: #dc3545 !important` | 77 |
| `.dropdown-item.text-danger:hover` | `color: white !important` | 78 |
| `.table-responsive` | `overflow: visible !important` | 99 |
| `.table` | `overflow: visible !important` | 103 |
| `.card-body` | `overflow: visible !important` | 107 |

</details>

> Raiz do problema original: Bootstrap `.table-responsive` usa `overflow-x: auto` nativamente. A solução aplicada na Fase 4 usou Popper.js com `boundary: 'viewport'` em vez de sobrescrever overflow globalmente.

#### `group-details.html` (bloco `<style>` inline) — ~~30+ ocorrências~~ → 0 (resolvido)

> ✅ **Resolvido em 2026-03-23:** Bloco `<style>` inline migrado para `groups-custom.css` (commit `1aed590`, Fase 3). Zero inline styles restantes em `group-details.html`.

### 2.2 z-index — Escada não documentada

| z-index | Elemento | Arquivo |
|---|---|---|
| -1 | (elemento aninhado) | `app.css` |
| 0 | (elemento) | `app.css` |
| 1 | `.group-card` / (outros) | `groups-custom.css` / `app.css` |
| 2 | `.group-card:hover` | `groups-custom.css` |
| 5 / 6 | (elementos internos) | `app.css` |
| 10 | `.app-search span` | `app.css` |
| 100 | (elemento) | `app.css` |
| 1001 | (elemento) | `app.css` |
| 1002 | `#page-topbar` | `app.css` |
| 9998 | `.rightbar-overlay` | `app.css` ⚠️ |
| 9999 | `.right-bar` | `app.css` ⚠️ |
| 9999 | `.dropdown-menu` / `.dropdown-menu-end` | `groups-custom.css` ⚠️ **COLISÃO** |
| 10000 | `.group-card:has(.btn-group.show)` / `.btn-group.show` | `groups-custom.css` |
| 10001 | `.btn-group .dropdown-menu` | `groups-custom.css` |
| 11000 | `.toast-container` | inline em 3 HTML |

> ⚠️ **COLISÃO REAL**: `app.css` usa `z-index: 9999` para `.right-bar` (painel lateral de configurações). `groups-custom.css` usa `z-index: 9999` para `.dropdown-menu`. Quando o painel de configurações está aberto, pode conflitar com dropdowns. A escalada de 1002 → 9998 → 9999 → 10000 → 10001 → 11000 nunca foi documentada.

### 2.3 `overflow` problemático

| Seletor | Valor aplicado | Impacto |
|---|---|---|
| `.table-responsive` (Bootstrap) | `overflow-x: auto` (nativo) | Scroll horizontal em tabelas pequenas |
| `.table-responsive` (groups-custom) | `overflow: visible !important` | **Quebra scroll horizontal** |
| `.table` | `overflow: visible !important` | Permite dropdown sair da tabela |
| `.card-body` | `overflow: visible !important` | Permite dropdown sair do card |
| `.group-card .card-body` | `overflow: visible !important` | Redundante com o anterior |

> Impacto real: em mobile, tabelas que deveriam ter scroll horizontal ficam sem esse comportamento, causando overflow horizontal da página.

### 2.4 Breakpoints em uso

| Arquivo | Breakpoints encontrados |
|---|---|
| `app.css` | `max-width: 992px`, `max-width: 991.98px`, `max-width: 767.98px`, `max-width: 767px`, `max-width: 600px`, `max-width: 575.98px`, `max-width: 380px`, `max-width: 1199.98px`, `min-width: 992px`, `min-width: 1200px`, `min-width: 1366px`, `@print` — **12 breakpoints distintos** |
| ~~`group-details.html` (inline `<style>`)~~ | ~~`max-width: 767px`~~ | ✅ Migrado para CSS externo |
| ~~`group.html` (inline `<style>`)~~ | ~~`max-width: 767px`~~ | ✅ Migrado para CSS externo |
| `groups-custom.css` | Verificar estado atual (Fase 3 adicionou breakpoints) |

> `app.css` usa valores com e sem `.98px` (ex: `767px` e `767.98px`) — inconsistência clássica de migração Bootstrap 4→5.
> Breakpoints oficiais do Bootstrap 5: sm=576px, md=768px, lg=992px, xl=1200px, xxl=1400px. O projeto usa variações fora desse padrão (600px, 380px, 1366px).

---

## 3. Inconsistências de UX/UI

### 3.0 Dois Design Systems coexistentes (CRÍTICO — adicionado 2026-03-23)

O projeto contém **dois design systems distintos** que nunca foram reconciliados:

| Aspecto | Skote Admin (ativo) | style.css (órfão) |
|---|---|---|
| Arquivo | `app.css` (3.771 linhas) | `style.css` (1.106 linhas) |
| Cor primária | `#556ee6` (azul índigo) | `#1f7a6f` (teal) |
| Cor secundária | `#5b73e8` | `#e07a5f` (coral) |
| Fonte body | Poppins | Manrope |
| Fonte display | — | Fraunces |
| Theming | `data-*` attributes | CSS variables (`--accent`, `--bg`, `--text`, etc.) |
| Componentes | Bootstrap classes | `.ui-card`, `.ui-button`, `.ui-pill`, `.ui-timeline` |
| Carregado | Todas as páginas | **Nenhuma página** |

> **Decisão necessária para Fase 2:** Adotar `style.css` como base do novo design system (migrando gradualmente) ou removê-lo como código morto. As CSS variables e a arquitetura de tokens em `style.css` são mais modernas que o padrão Skote.

### 3.1 Branding / Copy (CRÍTICO)

**Páginas afetadas:** login, register, forgot, reset, confirm-mail, email-verification, two-step-verification

| Elemento | Valor atual (ERRADO) | Valor esperado |
|---|---|---|
| `<title>` | `"... | Kovoy - Responsive Bootstrap 4 Admin Dashboard"` | `"... | Orlando 2026"` |
| `<meta name="description">` | `"Premium Multipurpose Admin & Dashboard Template"` | `"Group travel management"` |
| `<meta name="author">` | `"Themesbrand"` | `"Bruno Pinto Brum"` |
| Copy interno | `"Sign in to continue to Kovoy"`, `"Get your free Kovoy account now"`, `"Reset Password with Kovoy"` | Produto/viagem correto |

> Pages de app (`groups.html`, `group.html`, `group-details.html`) já têm meta tags corretas.

### 3.2 Estrutura HTML divergente

| Tipo | Estrutura `<body>` | Layout |
|---|---|---|
| Auth (7 páginas) | `<body>` sem atributos | `account-pages my-5 pt-sm-5` — centralizado |
| `invite.html` | `<body class="auth-body-bg">` | `wrapper-page` — layout completamente diferente |
| App pages | `<body data-layout-mode="light" data-topbar="light" data-sidebar="dark">` | sidebar + topbar |

> `invite.html` usa uma terceira estrutura que não existe em nenhuma outra página. Visualmente destoante.

### 3.3 Inventário de modais e seções de `group-details.html` (1.590 linhas)

**Modais Bootstrap (8 total):**

| ID | Linha | Função |
|---|---|---|
| `expenseModal` | 570 | CRUD de despesas |
| `flightModal` | 717 | CRUD de voos |
| `lodgingModal` | 941 | CRUD de hospedagens |
| `lodgingDetailsModal` | 1120 | Detalhes de hospedagem |
| `transportModal` | 1197 | CRUD de transportes |
| `ticketModal` | 1358 | CRUD de ingressos |
| `avatarModal` | 1526 | Upload de avatar |
| `confirmDeleteModal` | 1552 | Confirmação de exclusão |

> `lodgingDetailsModal` e `confirmDeleteModal` são genéricos e reutilizados por múltiplos módulos — oportunidade de padronização na Fase 4.

**Seções/módulos (8 total):**

| ID | Linha | Módulo |
|---|---|---|
| `dashboard` | 276 | Resumo geral (saldos + débitos) |
| `summaryCards` | 303 | Cards KPI (total, participantes, famílias, débitos) |
| `balances` | 338 | Saldos por participante e família |
| `debts` | 381 | Quem deve quem |
| `participants` | 390 | Famílias e participantes |
| `members` | 488 | Membros + convite (`inviteCollapse`) |
| `expenses` | 562 | Despesas |
| `flights` | 708 | Voos |
| `lodgings` | 941+ | Hospedagens |
| `transports` | 1197+ | Transportes |
| `tickets` | 1358+ | Ingressos |

---

### 3.4 Componentes duplicados / inconsistentes

| Componente | Inconsistência |
|---|---|
| **Topbar** | Idêntica em `group.html` e `group-details.html` — duplicação de HTML |
| **Sidebar** | `group.html` usa links para `/group-details#section`; `group-details.html` usa `#section` (âncoras locais) |
| **Megamenu** | Estrutura diferente entre `groups.html` e `group.html`/`group-details.html` |
| **Toast container** | Mesmo HTML inline duplicado em 3 arquivos com `style="z-index:11000"` hardcoded |
| **Select "Switch group"** | Mesmo elemento duplicado em `group.html` e `group-details.html` |
| **Select "Family balance mode"** | Idem — duplicado, mas com opções diferentes (bug: group.html não tem "Select a balance mode") |
| **CSS mobile de tabelas** | Bloco `<style>` idêntico duplicado em `group.html` e `group-details.html` |

### 3.4 Tipografia / visual

| Elemento | Valor observado |
|---|---|
| Fonte principal (app.css) | Poppins (300/400/500/600/700) |
| Fonte nas auth pages | Herdada de app.min.css — consistente |
| Logo dark height | `17px` (`.logo-lg`) |
| Logo light height | `36px` (`.logo-lg`) — **discrepância 2×** |
| Logo sm height | `22px` — consistente |
| Border radius nos cards (CSS) | `0.25rem` (Bootstrap padrão) |
| Border radius no CSS mobile inline | `border-radius: 0.25rem` — alinhado |
| Color primária | `#5b73e8` (groups-custom.css) |
| Color danger | `#dc3545` (groups-custom.css) — padrão Bootstrap |

### 3.5 Botões — Padrão inconsistente

| Contexto | Classe usada | Ripple |
|---|---|---|
| Auth pages | `btn btn-primary waves-effect waves-light` | Sim |
| App pages (topbar) | `btn btn-sm waves-effect` / `btn header-item waves-effect` | Sim |
| App pages (conteúdo) | `btn btn-outline-primary` / `btn btn-primary` | Não |
| Auth password toggle | `btn btn-light` | Não |

> Inconsistência: `waves-effect waves-light` aplicado seletivamente. Botões de conteúdo nas pages de app não têm ripple.

---

## 4. Priorização Técnica

### Severidade CRÍTICA — resolver em Fase 2/3

| # | Achado | Impacto de usuário | Status |
|---|---|---|---|
| C1 | `overflow: visible !important` global quebra scroll horizontal de tabelas em mobile | Navegação — dado inacessível em telas pequenas | ✅ Resolvido (Fase 4) |
| C2 | `groups-custom.css` com escopo global (`.dropdown-menu`, `.card-body`, `.table`) — afeta toda a app | Risco de regressão em novas páginas | ✅ Resolvido (Fase 4) |
| C3 | Bloco `<style>` de 100 linhas inline em `group-details.html` — CSS de responsividade no HTML | Manutenção — deveria estar em arquivo CSS externo | ✅ Resolvido (Fase 3) |
| C4 | Dois design systems coexistentes (`app.css` Skote vs `style.css` órfão) | Arquitetura — decisão bloqueante para Fase 2 | ⏳ Pendente |

### Severidade ALTA — resolver em Fase 5

| # | Achado | Impacto de usuário | Status |
|---|---|---|---|
| A1 | Títulos e meta tags de auth com copy do template Themesbrand | Confiança — SEO e aba do browser exibem nome errado | ✅ Resolvido (2026-03-23) |
| A2 | `invite.html` com estrutura HTML completamente diferente das outras auth pages | Consistência — usuário percebe layout diferente | Verificar se Fase 5 resolveu |
| A3 | Logo dark com `height=17px` vs logo light com `height=36px` | Legibilidade — logo praticamente invisível no modo dark | Verificar se Fase 5 resolveu |

### Severidade MÉDIA — resolver em Fases 3/4

| # | Achado | Impacto de usuário | Status |
|---|---|---|---|
| M1 | `groups-custom.css` não carregado em `group.html` e `group-details.html` | Funcional — dropdowns sem estilo correto | ✅ Resolvido (Quick Win) |
| M2 | ~20× `style="cursor:pointer"` em `th.sortable` — deveria ser classe CSS | Manutenção | ✅ Resolvido (Quick Win) |
| M3 | `z-index: 11000` inline em 3 arquivos — deveria ser variável/classe CSS | Manutenção | ✅ Resolvido (Quick Win) |
| M4 | `min-width` em selects duplicado entre `group.html` e `group-details.html` | Manutenção | ✅ Resolvido (Quick Win) |
| M5 | Sidebar com links divergentes entre `group.html` e `group-details.html` | Navegação | ✅ Resolvido (Fase 3, commit `61d58e6`) |
| M6 | z-index ladder sem documentação (10 → 9999 → 10000 → 10001 → 11000) | Risco de regressão | ⏳ Pendente |
| M7 | Breakpoints não documentados (767px e 992px sem mapeamento oficial) | Responsividade | ⏳ Pendente |

### Severidade BAIXA — limpeza

| # | Achado | Status |
|---|---|---|
| B1 | `owl.carousel.min.js` e `auth-2-carousel.init.js` carregados sem uso em 6 páginas auth | ✅ Resolvido (Quick Win) |
| B2 | `two-step-verification.init.js` carregado em `login.html` e `forgot.html` (irrelevante) | ✅ Resolvido (Quick Win) |
| B3 | `group.html` e `group-details.html` compartilham o mesmo `group.js` | ⏳ Aceito como intencional |
| B4 | `invite.html` não carrega `app.js` — consistente com não ter sidebar | ⏳ Aceito como intencional |

---

## 5. Quick Wins vs Mudanças Estruturais

### Quick wins (< 1h cada, sem risco de regressão)

| Item | Arquivo(s) | Esforço | Status |
|---|---|---|---|
| Migrar `style="cursor:pointer"` para `.sortable { cursor: pointer }` em CSS | `group-details.html` + CSS | 20 min | ✅ |
| Migrar `style="z-index: 11000;"` para classe `.toast-layer` em CSS | 3 HTMLs + CSS | 20 min | ✅ |
| Migrar `style="min-width: 200/220px"` para classes CSS | 2 HTMLs + CSS | 20 min | ✅ |
| Remover `owl.carousel` e `auth-2-carousel.init.js` das auth pages | 6 HTMLs | 15 min | ✅ |
| Remover `two-step-verification.init.js` de `login.html` e `forgot.html` | 2 HTMLs | 5 min | ✅ |
| Adicionar `groups-custom.css` em `group.html` e `group-details.html` | 2 HTMLs | 5 min | ✅ |
| Corrigir sidebar links divergentes | 2 HTMLs | 15 min | ✅ |
| Corrigir logo dark height de `17px` para `36px` | 2 HTMLs | 5 min | ✅ |
| Corrigir `<title>`, `<meta>`, copy "Kovoy" → "Orlando 2026" nas auth pages | 8 HTMLs | 30 min | ✅ |

**Progresso: 9/9 quick wins concluídos.**

### Mudanças estruturais (planejadas para Fases 2–4)

| Item | Risco | Fase |
|---|---|---|
| Extrair CSS mobile de tabelas do `<style>` inline de `group-details.html` para arquivo externo | Baixo | 2/4 |
| Resolver conflito overflow/dropdown sem `!important` (Popper.js boundary) | Médio | 3/4 |
| Definir e documentar z-index ladder oficial | Baixo | 2 |
| Padronizar estrutura de `invite.html` com demais auth pages | Baixo | 5 |
| Definir breakpoints oficiais e extrair toda responsividade para arquivo centralizado | Médio | 3 |
| Definir escopo correto para `groups-custom.css` (escopo global vs específico) | Médio | 4 |
| Criar componente de topbar/sidebar reutilizável (ou template parcial) | Alto | 4 |

---

## 6. Mapa de Conflitos CSS/JS

```
Bootstrap (.table-responsive)
  overflow-x: auto
      ↕ CONFLITO
groups-custom.css (.table-responsive)
  overflow: visible !important   ← sobrescreve scroll horizontal

Bootstrap (.dropdown-menu)
  z-index: 1000 (padrão)
      ↕ SOBRESCRITO
groups-custom.css
  z-index: 9999–10001 !important

Bootstrap (.modal)
  z-index: 1055 (padrão BS5)
      ↕ POTENCIAL CONFLITO
toast-container (inline)
  z-index: 11000   ← ok, mas não documentado

app.js
  metisMenu (sidebar) → dispara erro #20 (TypeError: $(...).metisMenu is not a function)
      ↕ DEPENDE DE
jQuery + metisMenu plugin (não encontrado nos scripts mapeados)
```

---

## 7. Dependências entre Fases

```
Fase 1 (baseline) ─── concluída
    │
    ▼
Fase 2 (tokens) ─── define paleta, tipografia, spacing, z-index, border-radius
    │
    ├──▶ Fase 3 (responsiva) ─── define breakpoints, estratégia mobile-first
    │        │
    │        └──▶ Fase 4 (componentes) ─── padroniza cards, dropdowns, tabelas, modais
    │                 │
    │    Fase 5 (auth) ─── pode correr em paralelo com Fase 4
    │                 │
    └────────────────▼
              Fase 6 (QA) ─── depende de todas as anteriores
```

**Restrições:**
- Fase 3 deve resolver o conflito overflow/dropdown **antes** de definir breakpoints (são interdependentes)
- Quick wins identificados na Fase 1 podem ser aplicados **imediatamente**, antes de Fase 2

---

## 8. Critérios de Pronto por Fase

| Fase | Critério de aceite |
|---|---|
| Fase 1 | Este documento publicado, revisado e sem ambiguidades |
| Fase 2 | Documento de tokens (paleta, tipografia, spacing, z-index) sem conflitos com Bootstrap |
| Fase 3 | Breakpoints oficiais documentados; overflow/dropdown resolvido sem `!important` global; tabelas responsivas em arquivo externo |
| Fase 4 | Catálogo de componentes core; `groups-custom.css` com escopo correto; sem CSS duplicado entre pages |
| Fase 5 | Auth pages com meta tags corretas; `invite.html` alinhada estruturalmente; copy do produto consistente |
| Fase 6 | Zero bug visual crítico em desktop/tablet/mobile; evidências de validação nas 3 viewports |

---

## 9. Entregáveis desta Fase

- [x] Inventário de superfície visual (páginas, CSS, JS por página)
- [x] Mapa de inline styles por arquivo
- [x] Catálogo de `!important` por seletor
- [x] z-index ladder mapeada
- [x] Conflitos de overflow documentados
- [x] Breakpoints em uso identificados
- [x] Inconsistências de branding/copy
- [x] Componentes duplicados mapeados
- [x] Priorização por severidade
- [x] Quick wins identificados e estimados
- [x] Mapa de conflitos CSS/JS
- [x] Matriz de dependências entre Fases 2–6
- [x] Critérios de pronto por fase

---

*Gerado como entregável da issue #51 — [Fase 1] Baseline visual e auditoria técnica*
