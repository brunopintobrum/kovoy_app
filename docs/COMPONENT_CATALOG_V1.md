# COMPONENT_CATALOG_V1.md

## Catálogo de Componentes — Kovoy v1

*Fase 4 do EPIC #50 — Refatoração Visual*

---

## 1. Botões

| Classe | Uso | Status | Regra |
|--------|-----|--------|-------|
| `btn btn-primary` | Ação principal (submit, salvar, criar) | ✅ Consistente | Manter |
| `btn btn-outline-secondary` | Cancelar, fechar, limpar filtros | ✅ Consistente | Manter |
| `btn btn-outline-primary` | Navegação secundária (links para seções) | ✅ Consistente | Manter |
| `btn btn-danger` | Ações destrutivas (Delete) | ✅ Consistente | Manter |
| `btn btn-light` | Cancelar em modais | ⚠️ Inconsistente | **Migrar para `btn-outline-secondary`** |
| `btn btn-success` | Auth (Verify, Confirm, Go to Groups) | ℹ️ Só em auth | Avaliar na Fase 5 |
| `btn-sm` | Filtros e header | ✅ Consistente | Manter |

**Regra definitiva para modais:**
```html
<!-- Cancelar / fechar -->
<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
<!-- Ação principal -->
<button type="button" class="btn btn-primary">Save</button>
<!-- Ação destrutiva -->
<button type="button" class="btn btn-danger">Delete</button>
```

---

## 2. Badges

| Classe | Uso | Regra |
|--------|-----|-------|
| `badge bg-soft-primary text-primary` | Role do usuário, contadores | Padrão principal |
| `badge bg-soft-success text-success` | Status pago / confirmado | Usar para estados positivos |
| `badge bg-soft-danger text-danger` | Status pendente / erro | Usar para estados negativos |
| `badge bg-soft-warning text-warning` | Status em progresso | Usar para estados intermediários |

---

## 3. Estados Vazios (Empty States)

**Problema:** copy inconsistente — `"No data."` vs `"No X yet."` vs sem ponto.

**Regra padronizada:** `"No [entidade] yet."` com letra minúscula no substantivo.

| Componente | Antes | Depois |
|-----------|-------|--------|
| Tabelas genéricas | `No data.` | `No [entidade] yet.` |
| Lista de grupos | `No groups yet.` | ✅ Manter |
| Lista de débitos | `No debts yet.` | ✅ Manter |
| Tabela de participantes | `No participants yet.` | Verificar no JS |
| Estado vazio de card mobile | `No groups yet.` | ✅ Manter |

**Template HTML padrão:**
```html
<!-- Em tabela -->
<tr>
  <td colspan="N" class="text-muted text-center py-3">No [entidade] yet.</td>
</tr>
<!-- Em lista -->
<li class="list-group-item text-muted text-center py-3">No [entidade] yet.</li>
<!-- Em card/div -->
<div class="text-muted text-center py-4">No [entidade] yet.</div>
```

---

## 4. Alertas e Feedback

| Classe | Quando usar |
|--------|------------|
| `alert alert-success` | Instrução inicial em formulário (ex: "Enter your email") |
| `alert alert-danger d-none` | Erro de formulário — mostrado via JS |
| `alert alert-success d-none` | Sucesso de ação — mostrado via JS |

**Regra:** alertas de feedback (`d-none`) devem sempre ter `id` descritivo e ser exibidos/ocultados via JS. Nunca usar `alert-warning` para erros.

---

## 5. Modais

**Padrão de estrutura (obrigatório):**
```html
<div class="modal-footer">
  <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
  <button type="button" class="btn btn-primary">Save</button>
</div>
```

**Modais destrutivos:**
```html
<div class="modal-footer">
  <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
  <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
</div>
```

---

## 6. Problema Crítico — Dropdowns cortados por `.table-responsive`

### Causa raiz
Bootstrap 5 aplica `overflow: auto` no `.table-responsive`, o que faz Popper.js posicionar dropdowns dentro do contexto de clipping. A cadeia atual de hacks com `!important`:

```css
/* HACKS ATUAIS — a eliminar */
.table-responsive { overflow: visible !important }
.table { overflow: visible !important }
.card-body { overflow: visible !important }
.dropdown-menu { z-index: 9999 !important; position: absolute !important }
.btn-group.show { z-index: 10000 !important }
.btn-group .dropdown-menu { z-index: 10001 !important }
```

### Solução correta — Popper.js `strategy: 'fixed'`

Inicializar dropdowns dentro de tabelas com `strategy: 'fixed'` no Popper. Com isso, o dropdown é posicionado relativo à viewport (não ao container pai), eliminando o problema de clipping:

```javascript
// Em group.js e groups.js — ao renderizar linhas de tabela
document.querySelectorAll('.table .dropdown-toggle').forEach(toggle => {
    new bootstrap.Dropdown(toggle, {
        popperConfig: {
            strategy: 'fixed'
        }
    });
});
```

Após implementar, os seguintes `!important` podem ser removidos de `groups-custom.css`:
- `.table-responsive { overflow: visible !important }`
- `.table { overflow: visible !important }`
- `.card-body { overflow: visible !important }`
- `.dropdown-menu { z-index: 9999 !important; position: absolute !important }`
- `.btn-group.show { z-index: 10000 !important }`
- `.btn-group .dropdown-menu { z-index: 10001 !important }`

> **Nota:** `.group-card { overflow: visible !important }` e `.group-card .card-body { overflow: visible !important }` podem permanecer temporariamente para os cards de grupos (não estão em `.table-responsive`).

---

## 7. Tokens de Cor — Correção de Divergência

`groups-custom.css` usa `#5b73e8` em 3 lugares onde deveria ser `#556ee6` (fonte da verdade: `app.min.css`).

| Linha | Propriedade | Valor atual | Valor correto |
|-------|-------------|-------------|---------------|
| 15 | `border-left-color` | `#5b73e8` | `#556ee6` |
| 138 | `border-color` (form-control:focus) | `#5b73e8` | `#556ee6` |
| 139 | `box-shadow` (form-control:focus) | `rgba(91, 115, 232, 0.15)` | `rgba(85, 110, 230, 0.15)` |

---

## 8. Quick Wins Imediatos (Fase 4)

| # | Mudança | Risco | Impacto |
|---|---------|-------|---------|
| 1 | Corrigir `#5b73e8` → `#556ee6` em groups-custom.css | Baixo | Cor consistente |
| 2 | `btn-light` → `btn-outline-secondary` em modais | Baixo | Padrão de botões |
| 3 | Implementar Popper `strategy: 'fixed'` nos dropdowns | Médio | Remove ~10 `!important` |
| 4 | Remover `!important` do overflow após fix do Popper | Médio | CSS mais limpo |

---

*Documento gerado na Fase 4 do EPIC #50 — Refatoração Visual.*
