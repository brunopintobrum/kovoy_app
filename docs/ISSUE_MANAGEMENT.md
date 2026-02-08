# Gerenciamento de Issues - Orlando 2026

## 📋 Visão Geral

Este projeto usa GitHub Issues + Projects para organizar tarefas, bugs e features.

---

## 🎯 Como Criar uma Issue

### Via GitHub (Recomendado)

1. Vá em: https://github.com/brunopintobrum/kovoy_app/issues/new/choose
2. Escolha o template apropriado:
   - 🐛 **Bug Report** - Para reportar bugs
   - ✨ **Feature Request** - Para sugerir funcionalidades
   - 📝 **Task** - Para tarefas técnicas ou melhorias

3. Preencha o template
4. Adicione labels apropriadas
5. Clique em "Submit new issue"

---

## 🏷️ Sistema de Labels

### Labels Principais

| Label | Cor | Uso |
|-------|-----|-----|
| `bug` | 🔴 Vermelho | Bugs e problemas |
| `enhancement` | 🔵 Azul | Novas funcionalidades |
| `task` | 🟢 Verde | Tarefas técnicas |
| `documentation` | 📘 Azul claro | Documentação |
| `good first issue` | 🟣 Roxo | Bom para iniciantes |
| `help wanted` | 🟡 Amarelo | Precisa de ajuda |
| `priority: high` | 🔴 Vermelho escuro | Alta prioridade |
| `priority: medium` | 🟠 Laranja | Média prioridade |
| `priority: low` | 🟢 Verde claro | Baixa prioridade |
| `blocked` | ⚫ Preto | Bloqueada por outra issue |
| `wontfix` | ⚪ Branco | Não será corrigida |
| `duplicate` | 🔘 Cinza | Duplicada |

### Como usar labels:

**Bugs:**
```
bug + priority: high + area/backend
```

**Features:**
```
enhancement + priority: medium + area/frontend
```

**Tasks:**
```
task + documentation
```

---

## 📊 GitHub Projects (Kanban Board)

### Colunas Padrão

```
📋 Backlog       → Issues não iniciadas
🔨 In Progress   → Em desenvolvimento
👀 In Review     → PR aberta, aguardando review
✅ Done          → Concluída
```

### Workflow

1. **Nova issue** → Vai para **Backlog**
2. **Começar trabalho** → Move para **In Progress**
3. **Abrir PR** → Move para **In Review** (automático)
4. **Mergear PR** → Move para **Done** (automático)

---

## 🔗 Linkando Issues com Commits

### Referenciar issue:

```bash
git commit -m "fix: corrige bug de login (#42)"
# Menciona a issue #42
```

### Fechar issue automaticamente:

```bash
git commit -m "fix: problema de timeout resolvido

Closes #42"
# Fecha a issue #42 quando PR for mergeada
```

**Keywords que fecham issues:**
- `closes #42`
- `fixes #42`
- `resolves #42`

---

## 🔗 Linkando Issues com PRs

Na descrição da PR:

```markdown
## Related Issues

- Closes #42
- Related to #38
- Blocks #50
```

---

## 📝 Boas Práticas

### Ao criar issue:

✅ **BOM:**
- Título descritivo: `[BUG] Login falha com OAuth do Google`
- Descrição completa usando o template
- Labels apropriadas
- Screenshots quando aplicável

❌ **RUIM:**
- Título vago: `Bug no login`
- Sem descrição
- Sem labels

### Ao trabalhar em issue:

1. **Assign** a issue para você
2. **Move** para "In Progress" no Project
3. **Crie branch** com referência:
   ```bash
   git checkout -b fix/issue-42-login-oauth
   ```
4. **Commita** referenciando a issue
5. **Abre PR** linkando a issue

---

## 🎯 Milestones

Use milestones para agrupar issues de uma versão:

**Exemplo:**
```
v1.0.0 - MVP
  ├── #42 Bug de login
  ├── #45 Feature de recuperação de senha
  └── #48 Documentação da API

v2.0.0 - Multi-moeda
  ├── #50 Adicionar suporte a EUR
  └── #51 Conversão automática
```

---

## 🔍 Filtros Úteis

### Ver todas as issues abertas:
```
is:issue is:open
```

### Ver bugs de alta prioridade:
```
is:issue is:open label:bug label:"priority: high"
```

### Ver suas issues:
```
is:issue is:open assignee:@me
```

### Ver issues sem assignee:
```
is:issue is:open no:assignee
```

---

## 🤖 Automações

### GitHub Actions pode automatizar:

- Adicionar label baseado em título
- Mover para coluna do Project baseado em evento
- Fechar issues stale (antigas sem atividade)
- Comentar em novas issues

**Exemplo de automação simples:** (`.github/workflows/issue-label.yml`)

```yaml
name: Auto Label
on:
  issues:
    types: [opened]
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - name: Add label based on title
        if: contains(github.event.issue.title, '[BUG]')
        run: gh issue edit ${{ github.event.issue.number }} --add-label "bug"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📈 Relatórios

### Ver progresso:

**Via GitHub Insights:**
https://github.com/brunopintobrum/kovoy_app/pulse

**Via Project Board:**
- Vá no seu Project
- Veja quantas issues em cada coluna
- Acompanhe velocity

---

## 🎓 Dicas Avançadas

### Templates de comentários salvos

Salve respostas comuns como "Saved replies":

1. Settings → Saved replies
2. Adicione templates como:
   - "Precisa de mais informações"
   - "Obrigado pela contribuição"
   - "Resolvido na versão X"

### Notificações

Configure notificações em:
https://github.com/settings/notifications

**Recomendado:**
- ✅ Participating (quando você é mencionado)
- ❌ Watching (muito spam para repo próprio)

---

## 📚 Recursos

- [GitHub Issues Docs](https://docs.github.com/en/issues)
- [GitHub Projects Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Mastering Issues](https://guides.github.com/features/issues/)

---

## 🆘 Ajuda

Dúvidas sobre o sistema de issues?

- Consulte este guia
- Abra uma issue de tipo "Task" com dúvida
- Veja exemplos de issues existentes

---

**Última atualização:** 2026-02-07
