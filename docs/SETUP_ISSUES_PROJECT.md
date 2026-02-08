# Setup de GitHub Issues + Projects

## 🎯 Guia Passo a Passo

Siga este guia para configurar completamente o sistema de Issues e Projects.

---

## ✅ Checklist de Setup

- [ ] Commit dos templates de issues
- [ ] Configurar labels no GitHub
- [ ] Criar GitHub Project (Kanban)
- [ ] Configurar automações do Project
- [ ] Criar primeira issue de exemplo
- [ ] Testar workflow completo

---

## 📋 PASSO 1: Commit dos Templates

Os templates já foram criados. Vamos commitá-los:

```bash
git add .github/ISSUE_TEMPLATE/
git add docs/ISSUE_MANAGEMENT.md
git add docs/SETUP_ISSUES_PROJECT.md
git commit -m "feat: adiciona sistema de Issues + Projects

- Templates de bug report, feature request e task
- Documentação completa de gerenciamento
- Guia de setup

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main
```

---

## 🏷️ PASSO 2: Configurar Labels

### Opção A: Via Interface do GitHub (Recomendado)

1. Vá em: https://github.com/brunopintobrum/kovoy_app/labels

2. **Delete labels padrão que não usar** (opcional):
   - Click na label → Delete

3. **Crie as seguintes labels:**

| Nome | Descrição | Cor |
|------|-----------|-----|
| `bug` | Algo não está funcionando | `#d73a4a` (vermelho) |
| `enhancement` | Nova funcionalidade ou pedido | `#a2eeef` (azul claro) |
| `task` | Tarefa técnica ou melhoria | `#0e8a16` (verde) |
| `documentation` | Melhorias na documentação | `#0075ca` (azul) |
| `good first issue` | Bom para novos contribuidores | `#7057ff` (roxo) |
| `help wanted` | Ajuda externa é bem-vinda | `#008672` (verde água) |
| `priority: high` | Alta prioridade | `#b60205` (vermelho escuro) |
| `priority: medium` | Média prioridade | `#fbca04` (amarelo) |
| `priority: low` | Baixa prioridade | `#c2e0c6` (verde claro) |
| `wontfix` | Não será trabalhado | `#ffffff` (branco) |
| `duplicate` | Issue duplicada | `#cfd3d7` (cinza) |
| `blocked` | Bloqueada por outra issue | `#000000` (preto) |

**Para cada label:**
- Clique em "New label"
- Preencha: Nome, Descrição, Cor
- Clique em "Create label"

### Opção B: Via Script (Mais Rápido)

Se tiver `gh` CLI instalado:

```bash
# Bug
gh label create bug --description "Algo não está funcionando" --color d73a4a

# Enhancement
gh label create enhancement --description "Nova funcionalidade ou pedido" --color a2eeef

# Task
gh label create task --description "Tarefa técnica ou melhoria" --color 0e8a16

# Documentation
gh label create documentation --description "Melhorias na documentação" --color 0075ca

# Good First Issue
gh label create "good first issue" --description "Bom para novos contribuidores" --color 7057ff

# Help Wanted
gh label create "help wanted" --description "Ajuda externa é bem-vinda" --color 008672

# Priority: High
gh label create "priority: high" --description "Alta prioridade" --color b60205

# Priority: Medium
gh label create "priority: medium" --description "Média prioridade" --color fbca04

# Priority: Low
gh label create "priority: low" --description "Baixa prioridade" --color c2e0c6

# Wontfix
gh label create wontfix --description "Não será trabalhado" --color ffffff

# Duplicate
gh label create duplicate --description "Issue duplicada" --color cfd3d7

# Blocked
gh label create blocked --description "Bloqueada por outra issue" --color 000000
```

---

## 📊 PASSO 3: Criar GitHub Project (Kanban)

1. **Vá em:** https://github.com/brunopintobrum/kovoy_app/projects

2. **Clique em "New project"**

3. **Escolha "Board" (Kanban)**

4. **Configure:**
   - Nome: `Orlando 2026 - Development`
   - Descrição: `Kanban board para gerenciar desenvolvimento`

5. **Clique em "Create"**

6. **Renomeie as colunas padrão:**
   - `Todo` → `📋 Backlog`
   - `In Progress` → `🔨 In Progress`
   - `Done` → `✅ Done`

7. **Adicione nova coluna:**
   - Clique em "+"
   - Nome: `👀 In Review`
   - Posição: Entre "In Progress" e "Done"

**Resultado final:**
```
📋 Backlog → 🔨 In Progress → 👀 In Review → ✅ Done
```

---

## 🤖 PASSO 4: Configurar Automações do Project

1. **No seu Project, clique em "⋯" (menu) → "Workflows"**

2. **Habilite os workflows padrão:**

   ✅ **Item added to project**
   - When: Issue or PR is added
   - Then: Set status to "📋 Backlog"

   ✅ **Item reopened**
   - When: Issue or PR is reopened
   - Then: Set status to "📋 Backlog"

   ✅ **Item closed**
   - When: Issue or PR is closed
   - Then: Set status to "✅ Done"

   ✅ **Pull request merged**
   - When: PR is merged
   - Then: Set status to "✅ Done"

3. **Crie workflow customizado:**

   **Auto-move PR to Review:**
   - Clique em "New workflow"
   - Name: `PR opened → In Review`
   - When: Pull request opened
   - Then: Set status to "👀 In Review"
   - Save

---

## 🧪 PASSO 5: Criar Issue de Exemplo

Vamos testar o sistema criando uma issue de exemplo:

1. **Vá em:** https://github.com/brunopintobrum/kovoy_app/issues/new/choose

2. **Escolha "Task"**

3. **Preencha:**
   ```
   Título: [TASK] Testar sistema de Issues + Projects

   Descrição:
   Primeira issue para validar que o sistema está funcionando.

   Objetivo: Verificar templates, labels e project board

   Critérios de Aceitação:
   - [x] Templates aparecem ao criar issue
   - [ ] Labels estão configuradas
   - [ ] Project board funciona
   - [ ] Automações funcionam
   ```

4. **Adicione labels:**
   - `task`
   - `good first issue`

5. **Adicione ao Project:**
   - No campo "Projects", selecione seu project
   - Status: "📋 Backlog"

6. **Clique em "Submit new issue"**

7. **Verifique:**
   - Issue foi criada? ✅
   - Apareceu no Project? ✅
   - Labels corretas? ✅

---

## ✅ PASSO 6: Testar Workflow Completo

Vamos simular um ciclo completo:

### 1. Mover issue para In Progress

- Vá no Project
- Arraste a issue para "🔨 In Progress"

### 2. Criar branch para a issue

```bash
git checkout -b task/test-issues-system
echo "# Sistema de Issues testado e funcionando!" >> docs/TEST.md
git add docs/TEST.md
git commit -m "docs: valida sistema de issues

Testa workflow completo de issues + project board.

Related to #1"
git push -u origin task/test-issues-system
```

### 3. Abrir PR

- Vá no GitHub
- Clique em "Compare & pull request"
- Preencha:
  ```
  ## Related Issues
  Closes #1

  ## Resumo
  Valida que sistema de issues está funcionando

  ## Tipo de mudança
  - [x] Documentação
  ```
- Clique em "Create pull request"

### 4. Verificar automação

- Issue moveu para "👀 In Review"? ✅

### 5. Mergear PR

- Aguarde CI passar
- Clique em "Merge pull request"
- Confirme

### 6. Verificar fechamento automático

- Issue #1 foi fechada automaticamente? ✅
- Moveu para "✅ Done"? ✅

---

## 🎉 Setup Completo!

Se todos os passos funcionaram, você tem:

✅ Templates de issues profissionais
✅ Sistema de labels organizado
✅ Kanban board funcionando
✅ Automações configuradas
✅ Workflow testado e validado

---

## 📊 Próximos Passos

### Para uso diário:

1. **Planeje seu trabalho:**
   - Crie issues para bugs, features e tasks
   - Adicione ao Project
   - Priorize com labels

2. **Durante desenvolvimento:**
   - Move issues para "In Progress"
   - Cria branches referenciando issues
   - Commits mencionam issues

3. **Ao completar:**
   - Abre PR linkando issue
   - Aguarda CI
   - Merge fecha issue automaticamente

### Manutenção:

- **Semanalmente:** Review do backlog
- **Mensalmente:** Clean up de issues antigas (stale)
- **Por milestone:** Planejar próxima versão

---

## 🆘 Troubleshooting

### Templates não aparecem ao criar issue

**Causa:** Templates não foram commitados/pushed

**Solução:**
```bash
git status
git add .github/ISSUE_TEMPLATE/
git push origin main
```

### Issue não aparece no Project

**Causa:** Não foi adicionada ao Project

**Solução:**
- Abra a issue
- Lado direito: Projects → Selecione o project
- Escolha a coluna

### Automações não funcionam

**Causa:** Workflows não foram habilitados

**Solução:**
- Vá no Project → ⋯ → Workflows
- Habilite os workflows necessários

---

## 📚 Recursos Adicionais

- [Documentação de Issues](docs/ISSUE_MANAGEMENT.md)
- [GitHub Projects Guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)

---

**Setup criado em:** 2026-02-07
**Versão:** 1.0
