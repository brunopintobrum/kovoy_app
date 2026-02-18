# RESPONSIVE_ARCHITECTURE_V1.md

## Projeto: Kovoy — Arquitetura Responsiva v1

*Fase 3 do EPIC #50 — Refatoração Visual*

---

## 1. Estratégia Oficial Mobile-First

A abordagem adotada é **mobile-first com Bootstrap 5**:

- Estilos base são escritos para mobile; breakpoints `min-width` expandem para telas maiores.
- Layout é controlado **exclusivamente por CSS** — JavaScript não deve manipular propriedades de layout, `display`, `width` ou `visibility` para fins responsivos.
- Nenhum `@media` query fica em arquivo HTML (`<style>` inline é dívida técnica a eliminar).
- Todos os breakpoints do projeto seguem a tabela oficial Bootstrap 5 abaixo.
- Breakpoints customizados (`767px`, `960px`, `640px`) encontrados no código atual são **migrados** para os valores padrão mais próximos do Bootstrap.

---

## 2. Breakpoints Oficiais do Projeto

| Alias | Prefixo Bootstrap | Limite         | Uso no Kovoy                          |
|-------|-------------------|----------------|---------------------------------------|
| xs    | *(sem prefixo)*   | < 576px        | Mobile portrait — layout mínimo       |
| sm    | `sm`              | ≥ 576px        | Mobile landscape / cards empilhados   |
| md    | `md`              | ≥ 768px        | Tablet — tabelas começam a aparecer   |
| lg    | `lg`              | ≥ 992px        | Desktop — sidebar visível, 2 colunas  |
| xl    | `xl`              | ≥ 1200px       | Desktop largo — nome de usuário na topbar |
| xxl   | `xxl`             | ≥ 1400px       | Telas grandes                         |

> **Regra de migração:** `max-width: 767px` → usar `< md` (padrão BS5: `@media (max-width: 767.98px)`).
> `window.innerWidth >= 992` → usar classe CSS `d-none d-lg-block` ou breakpoint `lg`.

---

## 3. Comportamento por Breakpoint

| Componente              | xs / sm (< 768px)                    | md (768–991px)                      | lg+ (≥ 992px)                        |
|-------------------------|--------------------------------------|-------------------------------------|--------------------------------------|
| **Topbar**              | Visível, botão hambúrguer ativo      | Visível, hambúrguer ativo           | Visível, mega-menu habilitado        |
| **Mega-menu topbar**    | Oculto (`d-none`)                    | Oculto                              | Visível (`d-lg-block`)               |
| **Nome usuário topbar** | Oculto (`d-none`)                    | Oculto                              | Visível (`d-xl-inline-block`)        |
| **Sidebar**             | Oculta, toggle via `.sidebar-enable` | Oculta, toggle                      | Visível e fixo (250px)              |
| **Grid app pages**      | `col-12` (1 coluna)                  | `col-12` (1 coluna)                 | `col-lg-4` / `col-lg-8` (2 colunas) |
| **Tabelas de dados**    | Cards empilhados (CSS puro)          | Tabela horizontal com scroll        | Tabela horizontal completa           |
| **Modais**              | Full-width (`modal-dialog-scrollable`)| Normal                              | Normal                               |
| **Filtros colapsáveis** | Colapsados (toggle por botão)        | Visíveis                            | Visíveis                             |
| **Inline detail rows**  | Abre modal                           | Abre modal                          | Expande row na tabela                |

---

## 4. Plano de Migração do Bloco `<style>` Inline

### Situação atual
`group-details.html` linhas 14–112 contém um bloco `<style>` com ~100 linhas de CSS mobile, todos com `!important`, usando seletores ultra-específicos como:
```css
body table.table.table-mobile-cards thead { display: none !important; }
```

### Causa raiz
O bloco foi adicionado com seletores de alta especificidade e `!important` em massa porque o CSS inline era a única forma de sobrescrever os estilos de `app.min.css` e `Bootstrap` sem editar os arquivos minificados.

### Solução
Migrar o bloco para `groups-custom.css` usando seletores simplificados — a especificidade via arquivo externo + `!important` pontual já é suficiente:

**Antes (inline, ultra-específico):**
```css
body table.table.table-mobile-cards tbody tr {
    display: block !important;
    margin-bottom: 1rem !important;
    ...
}
```

**Depois (groups-custom.css, simplificado):**
```css
@media (max-width: 767.98px) {
    .table-mobile-cards thead { display: none; }
    .table-mobile-cards,
    .table-mobile-cards tbody,
    .table-mobile-cards tr,
    .table-mobile-cards td { display: block; width: 100%; box-sizing: border-box; }
    .table-mobile-cards tr {
        margin-bottom: 1rem;
        border: 1px solid #dee2e6;
        border-radius: 0.25rem;
        padding: 1rem;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.1);
    }
    .table-mobile-cards td {
        border: none;
        padding: 0.5rem 0 0.5rem 50%;
        position: relative;
        min-height: 1.5rem;
    }
    .table-mobile-cards td::before {
        content: attr(data-label);
        position: absolute;
        left: 0;
        top: 0.5rem;
        width: 45%;
        padding-right: 10px;
        font-weight: 700;
        color: #495057;
    }
    .table-mobile-cards td:last-child {
        padding-left: 0;
        padding-top: 1rem;
        border-top: 1px solid #dee2e6;
        margin-top: 0.75rem;
        text-align: right;
    }
    .table-mobile-cards td:last-child::before { display: none; }

    /* Filtros colapsáveis no mobile */
    .lodging-filters-container {
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: all 0.3s ease;
    }
    .lodging-filters-container.show {
        max-height: 500px;
        opacity: 1;
        margin-top: 1rem;
    }
}
```

**Resultado:** remoção de ~40 `!important` e eliminação do bloco `<style>` do HTML.

---

## 5. Plano para Eliminar `applyMobileTableStyles()` do JS

### Situação atual (`group.js` linhas ~4824–4889)

A função `applyMobileTableStyles()`:
1. Usa `window.matchMedia('(max-width: 767px)')` para detectar mobile
2. Manipula DOM: adiciona `data-label` nos `<td>` e altera `display` inline via JS
3. É chamada em: `resize`, `orientationchange`, `setTimeout(100ms)` e `setTimeout(500ms)`

Além disso, `window.matchMedia('(max-width: 767px)')` aparece em mais 2 lugares no JS para decidir entre modal vs inline row.

### Causa raiz
O JS foi necessário para contornar limitações de especificidade CSS (o CSS inline não conseguia sobrescrever `app.min.css`). Com o bloco migrado para `groups-custom.css` com especificidade adequada, o JS se torna redundante.

### Plano de remoção (sequencial)

| Passo | Ação |
|-------|------|
| 1 | Migrar CSS do `<style>` inline para `groups-custom.css` (item 4 acima) |
| 2 | Verificar se o CSS migrado renderiza corretamente sem o JS |
| 3 | Remover `applyMobileTableStyles()` e seus 4 event listeners/timers |
| 4 | Manter o `data-label` nos `<td>` do HTML (são necessários para o `::before` do CSS) |
| 5 | Substituir as 2 ocorrências de `matchMedia` por detecção de breakpoint via CSS class (ex: checar se `d-none d-lg-block` está visível) |

> **Nota sobre os 2 matchMedia restantes:** A lógica "mobile abre modal / desktop expande row" pode ser mantida em JS mas deve usar `window.matchMedia('(max-width: 767.98px)')` (valor correto do BS5) e **não manipular estilos** — apenas decidir qual ação executar (abrir modal vs toggle classe).

---

## 6. Inline Styles Residuais a Eliminar

| Arquivo | Linha | Inline style | Classe proposta |
|---------|-------|--------------|-----------------|
| `group-details.html` | 549 | `style="width: 180px"` | `.kv-col-role` → `width: 180px` em groups-custom.css |
| `group-details.html` | 550 | `style="width: 140px"` | `.kv-col-action` → `width: 140px` em groups-custom.css |
| `register.html` | 110 | `style="height: 6px"` | `.kv-progress-password` → `height: 6px` |
| `register.html` | 111 | `style="width: 0%"` | JS deve setar `width` via classe ou variável CSS `--progress` |

---

## 7. Matriz: Problema → Solução → Fase

| # | Problema atual | Solução | Fase |
|---|---------------|---------|------|
| 1 | `<style>` inline com ~100 linhas e ~40 `!important` em `group-details.html` | Migrar para `groups-custom.css` com media query simplificada | Fase 3 |
| 2 | `applyMobileTableStyles()` duplica lógica do CSS via JS | Remover após migração CSS; manter só lógica de ação (modal vs row) | Fase 3 |
| 3 | Breakpoint `767px` inconsistente com BS5 (`767.98px`) | Padronizar para `767.98px` nos novos media queries | Fase 3 |
| 4 | `window.innerWidth >= 992` hardcoded em JS | Substituir por checagem de visibilidade de elemento Bootstrap | Fase 3 |
| 5 | `.table-responsive { overflow: visible !important }` quebra scroll horizontal mobile | Resolver via Popper.js `boundary: 'viewport'` para dropdowns | Fase 4 |
| 6 | 25 `!important` em `groups-custom.css` não relacionados a responsividade | Refatorar seletores para aumentar especificidade sem `!important` | Fase 4 |
| 7 | `min-width: 200/220px` em selects causa overflow no mobile | Trocar por `width: 100%` com `@media lg+ min-width` | Fase 3 |
| 8 | Inline styles de `width` em `<th>` de tabelas | Mover para classes `.kv-col-role` / `.kv-col-action` | Fase 3 |

---

## 8. Checklist de Validação por Viewport

### Mobile (< 576px)
- [ ] Topbar visível e funcional, hambúrguer abre sidebar
- [ ] Sidebar oculta por padrão, fecha ao clicar em link
- [ ] Todas as tabelas renderizam como cards empilhados
- [ ] Filtros colapsáveis funcionam com toggle
- [ ] Modais abrem em full-width (`modal-dialog-scrollable`)
- [ ] Sem scroll horizontal na página

### Tablet (576px – 991px)
- [ ] Grid de 1 coluna (formulários e listas empilhados)
- [ ] Tabelas mostram scroll horizontal (não cards)
- [ ] Sidebar oculta com toggle
- [ ] Selects não causam overflow

### Desktop (≥ 992px)
- [ ] Sidebar visível e fixa (250px)
- [ ] Grid de 2 colunas nas páginas app
- [ ] Mega-menu da topbar visível
- [ ] Tabelas completas com colunas sortáveis
- [ ] Inline detail rows expandem ao clicar (não abre modal)
- [ ] Dropdowns não cortados por `.table-responsive`

### Geral (todos os viewports)
- [ ] Nenhum `style=""` inline adicionado no HTML
- [ ] Nenhum `@media` dentro de arquivo HTML
- [ ] JS não manipula `display`, `width`, `visibility` para layout
- [ ] Contraste de texto passa WCAG AA em todos os breakpoints

---

*Documento gerado na Fase 3 do EPIC #50 — Refatoração Visual.*
*Próxima atualização: após implementação dos quick wins responsivos.*
