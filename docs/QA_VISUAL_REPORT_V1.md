# QA_VISUAL_REPORT_V1.md

## Relatório de QA Visual — Kovoy EPIC #50

*Fase 6 — Encerramento do ciclo de Refatoração Visual*

---

## 1. Resumo Executivo

O EPIC #50 de Refatoração Visual foi executado em 6 fases ao longo do ciclo. O objetivo era eliminar dívida técnica de CSS/HTML acumulada pelo uso de um template de terceiros (Themesbrand), padronizar componentes, estabelecer um design system e garantir arquitetura responsiva previsível.

**Status:** ✅ Fases 1–5 concluídas | ⏳ PRs #61 e #62 aguardando merge | 📋 Checklist manual de QA pendente

---

## 2. Métricas Antes / Depois

### HTML — todas as 11 páginas

| Métrica | Antes (início Fase 1) | Depois (Fase 5) |
|---------|----------------------|-----------------|
| `style=""` inline em HTML | ~45 | **0** |
| Blocos `<style>` inline | 3 | **0** |
| `!important` em HTML | 40+ | **0** |
| `!important` em CSS customizado | 25 (`groups-custom.css`) | **0** (PR #61) |
| Typos JS (`javascript::`) | 1 | **0** |
| Meta tags desatualizadas (author/description) | 7 páginas | **0** |
| Scripts mortos removidos | — | 8 scripts |
| Imagens sem `alt=` | 0 | **0** |
| Bloco `<style>` mobile em group-details | ~100 linhas | **0** (migrado para CSS) |
| `applyMobileTableStyles()` em group.js | 68 linhas | **0** (removido) |

### CSS Customizados

| Arquivo | Estado | `!important` |
|---------|--------|--------------|
| `groups-custom.css` | Refatorado | 0 (após merge PR #61) |
| `auth-custom.css` | Criado na Fase 5 | 0 |

### Documentação gerada

| Documento | Fase |
|-----------|------|
| `docs/BASELINE_VISUAL.md` | Fase 1 |
| `docs/DESIGN_SYSTEM_V1.md` | Fase 2 |
| `docs/RESPONSIVE_ARCHITECTURE_V1.md` | Fase 3 |
| `docs/COMPONENT_CATALOG_V1.md` | Fase 4 |
| `docs/QA_VISUAL_REPORT_V1.md` | Fase 6 |

---

## 3. Checklist de Validação por Viewport (Manual)

> Preencher após o merge das PRs #61 e #62.

### Desktop (≥ 1200px)
- [ ] Sidebar visível e fixo (250px)
- [ ] Mega-menu da topbar visível
- [ ] Grid de 2 colunas nas páginas app (group.html, groups.html)
- [ ] Dropdowns de tabela abrem sem ser cortados (via Popper fixed)
- [ ] Modais centralizam corretamente
- [ ] Tabelas completas com colunas sortáveis

### Tablet (768px – 1199px)
- [ ] Sidebar oculto com toggle funcional
- [ ] Grid de 1 coluna (formulários empilhados)
- [ ] Tabelas com scroll horizontal (sem cards)
- [ ] Selects sem overflow horizontal

### Mobile (≤ 767px)
- [ ] Sidebar oculto por padrão, abre/fecha via hambúrguer
- [ ] Tabelas renderizam como cards (`.table-mobile-cards`)
- [ ] Labels dos cards visíveis via `data-label` + `::before`
- [ ] Filtros colapsáveis funcionam com toggle
- [ ] Modais full-width com scroll
- [ ] Sem scroll horizontal na página

### Auth pages (todos os viewports)
- [ ] Login/Register/Forgot/Reset renderizam corretamente
- [ ] Invite page carrega sem layout quebrado
- [ ] Ícones de estado (`.kv-icon-state`) em tamanho correto

### Geral
- [ ] Sem overflow horizontal em nenhuma página
- [ ] Toasts aparecem acima de modais (z-index 11000)
- [ ] Dropdowns não são cortados por containers
- [ ] Spacing consistente entre páginas

---

## 4. Riscos Residuais

| # | Descrição | Severidade | Ação |
|---|-----------|-----------|------|
| 1 | Seção de social login (Facebook/Twitter disabled) ainda presente no HTML de login e register | Baixa | Remover na Fase UX (#35) ou criar issue dedicada |
| 2 | `btn-success` nas telas auth (email-verification, confirm-mail, two-step) — inconsistente com painel | Baixa | Aceitável no contexto; avaliar na Fase UX |
| 3 | `validation.init.js` (template legado) ainda no register.html | Baixa | Verificar se é realmente usado; remover se não for |
| 4 | Dropdowns da sidebar/topbar em group-details.html não usam Popper fixed | Baixa | Não estão em `.table-responsive`, sem impacto |
| 5 | Script `app.js` desativado intencionalmente em algumas páginas | Info | Documentado; sem impacto |

---

## 5. Follow-ups para Issues Existentes

### Issue #33 — Acessibilidade (a11y)
Itens visuais a encaminhar:
- Verificar contraste de todos os componentes de status/alerta (WCAG AA: ratio ≥ 4.5:1)
- Verificar foco visível (`:focus-visible`) em botões, inputs e links
- Verificar navegação por teclado nos fluxos: login → dashboard → grupo → modal
- Verificar `aria-label` em botões de ícone sem texto (ex: toggle de senha, hambúrguer)

### Issue #35 — Melhorias de UX
Itens visuais a encaminhar:
- Avaliar remoção da seção de social login das telas auth
- Avaliar copy dos estados vazios em todas as tabelas (padronizar para "No X yet.")
- Avaliar estados de loading nas tabelas (skeleton vs spinner)
- Avaliar consistência de botão primário nas telas auth (btn-success vs btn-primary)

---

## 6. Critérios de Encerramento do EPIC #50

O EPIC pode ser encerrado quando:

- [x] Fase 1: Baseline visual documentado
- [x] Fase 2: Design System V1 publicado
- [x] Fase 3: Arquitetura responsiva documentada e CSS inline migrado
- [x] Fase 4: `!important` zerados, tokens corrigidos, Popper fix aplicado
- [x] Fase 5: Auth pages unificadas visualmente
- [ ] **PR #61 mergeada** (Fase 4)
- [ ] **PR #62 mergeada** (Fase 5)
- [ ] Checklist manual de QA (seção 3) concluído sem bugs críticos
- [ ] Bugs visuais críticos encontrados no QA encaminhados para issues próprias
- [ ] EPIC #50 fechado no GitHub

---

## 7. Resumo de PRs do EPIC

| PR | Fase | Status |
|----|------|--------|
| #58 | Fase 1 — Quick wins iniciais | ✅ Mergeada |
| #59 | Fase 2 — Design System V1 | ✅ Mergeada |
| #60 | Fase 3 — Arquitetura responsiva | ✅ Mergeada |
| #61 | Fase 4 — Componentes core | ⏳ Aguardando merge |
| #62 | Fase 5 — Auth visual | ⏳ Aguardando merge |

---

*Documento gerado na Fase 6 do EPIC #50 — Refatoração Visual Kovoy.*
