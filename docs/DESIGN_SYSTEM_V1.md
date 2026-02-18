# DESIGN_SYSTEM_V1.md

## Introdução e Propósito

Este documento apresenta o Design System do projeto Kovoy, um aplicativo para viagens em grupo. O Design System é uma coleção de componentes, diretrizes e tokens que asseguram a consistência e eficiência no desenvolvimento de UI. O objetivo é facilitar a colaboração entre equipes de design e desenvolvimento, garantir uma experiência de usuário coesa, e acelerar o processo de construção de novas funcionalidades.

---

## Tabela de Tokens de Cor

| Nome Semântico  | Valor Hex              | Uso                                          |
|-----------------|------------------------|----------------------------------------------|
| Primary         | `#556ee6`              | Principais elementos interativos             |
| Primary Soft    | `rgba(85,110,230,.18)` | Fundos e sobreposições secundárias           |
| Secondary       | `#74788d`              | Elementos secundários                        |
| Success         | `#34c38f`              | Indicadores de sucesso                       |
| Info            | `#50a5f1`              | Informações gerais                           |
| Warning         | `#f1b44c`              | Alertas e mensagens de cuidado               |
| Danger          | `#f46a6a`              | Alertas de erro e críticas                   |
| Dark            | `#343a40`              | Textos e fundos escuros                      |
| Light           | `#eff2f7`              | Fundos claros e neutros                      |
| Muted           | `#74788d`              | Textos desativados e secundários             |
| Body bg         | `#f8f8fb`              | Fundo principal do aplicativo                |
| Sidebar dark bg | `#2a3042`              | Fundo do menu lateral                        |
| Topbar light bg | `#ffffff`              | Fundo do cabeçalho                           |
| Text dark       | `#495057`              | Texto principal                              |
| Link color      | `#556ee6`              | Cor dos links                                |
| Border color    | `#eff2f7`              | Cores de bordas                              |
| White           | `#ffffff`              | Elementos e fundos brancos                   |

> ⚠️ **Divergência a corrigir (Fase 4):** `groups-custom.css` usa `#5b73e8` onde deveria usar `#556ee6`. O `app.min.css` é a fonte da verdade.

---

## Tipografia

- **Font Family:** `'Nunito', sans-serif`
- **Base Size:** `0.9rem` (≈ 14.4px)

### Escala de Tamanhos

| Classe          | Tamanho |
|-----------------|---------|
| `.font-size-10` | 10px    |
| `.font-size-11` | 11px    |
| `.font-size-12` | 12px    |
| `.font-size-13` | 13px    |
| `.font-size-14` | 14px    |
| `.font-size-15` | 15px    |
| `.font-size-16` | 16px    |
| `.font-size-18` | 18px    |
| `.font-size-20` | 20px    |
| `.font-size-22` | 22px    |
| `.font-size-24` | 24px    |

### Headings

| Elemento | Tamanho  |
|----------|----------|
| `h1`     | 2.5em    |
| `h2`     | 2em      |
| `h3`     | 1.75em   |
| `h4`     | 1.5em    |
| `h5`     | 1.25em   |
| `h6`     | 1em      |

---

## Espaçamento

| Token | Valor  | Equivalente Bootstrap |
|-------|--------|-----------------------|
| 1     | 4px    | `p-1`, `m-1`          |
| 2     | 8px    | `p-2`, `m-2`          |
| 3     | 12px   | —                     |
| 4     | 16px   | `p-3`, `m-3`          |
| 5     | 24px   | `p-4`, `m-4`          |
| 6     | 32px   | —                     |
| 7     | 48px   | —                     |
| 8     | 64px   | —                     |

**Constantes estruturais:**
- Largura do Sidebar: `250px`
- Altura do Topbar: `70px`
- Padding do Card Body: `1.25rem`

---

## Border Radius

| Categoria | Valor    | Uso típico                     |
|-----------|----------|--------------------------------|
| `sm`      | `0.2rem` | Badges, inputs pequenos        |
| `default` | `0.25rem`| Cards, dropdowns, modais       |
| `lg`      | `0.3rem` | Cards grandes, panels          |
| `pill`    | `50rem`  | Badges arredondados, botões    |
| `circle`  | `50%`    | Avatares, ícones circulares    |

---

## Sombras / Elevação

| Nível   | Componente   | CSS                                                                |
|---------|--------------|--------------------------------------------------------------------|
| Baixo   | Card         | `0 2px 4px rgba(0,0,0,.08)`                                        |
| Médio   | Dropdown     | `0 2px 4px rgba(0,0,0,.05), 0 4px 12px rgba(85,110,230,.15)`      |
| Alto    | Sidebar      | `0 0.75rem 1.5rem rgba(18,38,63,.03)`                              |

---

## Z-Index Semântico

### Estado atual (com conflito documentado)

| Componente         | Valor atual | Arquivo              |
|--------------------|-------------|----------------------|
| Topbar             | 1002        | app.min.css          |
| Sidebar            | 1003        | app.min.css          |
| Modal backdrop     | 1040        | Bootstrap            |
| Modal              | 1050        | Bootstrap            |
| `.right-bar`       | 9999        | app.min.css          |
| `.dropdown-menu`   | 9999        | groups-custom.css ⚠️ |
| Toast container    | 11000       | inline → `.toast-layer` |

### Nova escala proposta (a implementar na Fase 3)

| Camada semântica   | Valor  | Componentes                      |
|--------------------|--------|----------------------------------|
| Base               | 1–999  | Layout, estrutura de página      |
| Navigation         | 1000   | Topbar, Sidebar                  |
| Overlay            | 1040   | Modal backdrop                   |
| Modal              | 1050   | Modais, drawers                  |
| Dropdown           | 1060   | Dropdowns, tooltips, popovers    |
| Panel              | 9000   | Right-bar, side panels           |
| Notification       | 11000  | Toast, snackbar                  |

> **Regra:** nenhum componente deve ter z-index hardcoded no HTML. Usar apenas as classes `.toast-layer` e futuras classes semânticas definidas aqui.

---

## Regras de Aplicação

### `!important`
- **Proibido** em código novo.
- Os 25 `!important` existentes em `groups-custom.css` são dívida técnica a ser eliminada gradualmente (Fases 3 e 4).
- Exceção única permitida: override de bibliotecas de terceiros que não expõem API de customização.

### Estilos Inline
- **Proibidos** em HTML. Todo estilo deve estar em classe CSS.
- Estilos inline existentes foram removidos na Fase 1 (quick wins).
- Em PR de UI, qualquer `style=""` no HTML deve ser bloqueado na revisão.

### Utility vs Component

| Use Utility quando...                        | Use Component quando...                         |
|----------------------------------------------|-------------------------------------------------|
| Aplicar espaçamento pontual (`mt-2`, `px-4`) | O padrão se repete em 3+ lugares                |
| Ajustar alinhamento de texto                 | Há estado, variante ou lógica visual envolvida  |
| Aplicar cor a um elemento único              | O bloco tem semântica própria (card, modal, badge) |

---

## Convenção de Nomenclatura CSS (BEM)

Use a metodologia **BEM** (Block Element Modifier) para classes customizadas:

```css
/* Bloco */
.expense-card { }

/* Elemento */
.expense-card__title { }
.expense-card__amount { }

/* Modificador */
.expense-card--overdue { }
.expense-card--paid { }
```

**Prefixo Kovoy:** para distinguir classes do projeto das de bibliotecas, usar prefixo `kv-`:

```css
.kv-badge--currency { }
.kv-table--sortable { }
.kv-avatar--sm { }
```

---

## Checklist PR para Mudanças Visuais

Antes de abrir PR que afete CSS ou HTML visual, verificar:

- [ ] Nenhum `style=""` inline foi adicionado ao HTML
- [ ] Nenhum `!important` novo foi introduzido
- [ ] Cores usadas estão na tabela de tokens (sem hex avulso)
- [ ] Z-index segue a escala semântica definida aqui
- [ ] Classes seguem convenção BEM ou utilities Bootstrap
- [ ] Testado em mobile (≤768px) e desktop (≥1200px)
- [ ] Contraste de texto passa WCAG AA (ratio ≥ 4.5:1)
- [ ] Nenhum script de biblioteca removido sem verificar dependências

---

*Documento gerado na Fase 2 do EPIC #50 — Refatoração Visual.*
*Próxima atualização prevista: Fase 4 (migração de cores e remoção dos !important).*
