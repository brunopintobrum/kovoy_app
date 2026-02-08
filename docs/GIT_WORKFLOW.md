# Git Workflow - Orlando 2026

## Estratégia de Branching: GitHub Flow

Este projeto usa **GitHub Flow**, uma estratégia simples e eficiente para desenvolvimento contínuo.

### Estrutura de Branches

```
main (protegida, sempre deployável)
  ├── feature/nome-da-funcionalidade
  ├── fix/descricao-do-bug
  └── hotfix/emergencia-critica
```

### Regras da Branch Principal

- **Nome:** `main` (renomeada de `master`)
- **Status:** Sempre deve estar funcionando e deployável
- **Proteção:** Não aceita push direto (apenas via Pull Request)
- **CI/CD:** Testes automatizados devem passar antes do merge

---

## Workflow Passo a Passo

### 1. Criar nova branch para trabalho

```bash
# Atualizar main
git checkout main
git pull origin main

# Criar branch feature
git checkout -b feature/nome-descritivo

# Criar branch fix
git checkout -b fix/descricao-bug

# Criar branch hotfix (emergências)
git checkout -b hotfix/problema-critico
```

### 2. Desenvolver e commitar

```bash
# Fazer alterações no código
git add arquivo1.js arquivo2.js

# Commitar com mensagem descritiva
git commit -m "Adiciona validação de email no formulário de registro"

# Ou usar Conventional Commits (recomendado):
git commit -m "feat: adiciona validação de email no registro"
git commit -m "fix: corrige erro de timezone em datas"
git commit -m "refactor: simplifica lógica de split de despesas"
```

#### Conventional Commits (Recomendado)

Formato: `<tipo>: <descrição>`

**Tipos principais:**
- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `refactor:` - Refatoração sem alterar comportamento
- `test:` - Adiciona ou corrige testes
- `docs:` - Atualiza documentação
- `style:` - Formatação de código (sem alterar lógica)
- `perf:` - Melhoria de performance
- `chore:` - Tarefas de manutenção (deps, configs)

### 3. Push da branch

```bash
# Primeira vez (cria branch remota)
git push -u origin feature/nome-descritivo

# Pushes subsequentes
git push
```

### 4. Abrir Pull Request

1. Vá no GitHub: https://github.com/seu-usuario/orlando-2026
2. Clique em "Compare & pull request"
3. Preencha o template:
   - Resumo claro das mudanças
   - Tipo de mudança (bug fix, feature, etc)
   - Passos para testar
   - Checklist completo
4. Clique em "Create pull request"

### 5. Code Review (mesmo sozinho!)

**Por que fazer PR sozinho?**
- ✓ Visualiza diff completo antes de mergear
- ✓ CI/CD valida automaticamente
- ✓ Histórico mais organizado
- ✓ Documenta decisões técnicas
- ✓ Prepara para colaboradores futuros

**Checklist de revisão:**
- [ ] CI passou (testes green)
- [ ] Código segue os padrões
- [ ] Sem vulnerabilidades introduzidas
- [ ] Documentação atualizada se necessário

### 6. Merge da PR

Após CI passar e revisão:

1. Clique em "Merge pull request"
2. Escolha o tipo de merge:
   - **Squash and merge** (recomendado): Une todos commits em um
   - **Merge commit**: Mantém histórico completo
   - **Rebase and merge**: Linear, sem merge commit
3. Delete a branch após merge (GitHub oferece botão automático)

### 7. Limpar branches locais

```bash
# Voltar para main
git checkout main

# Atualizar main
git pull origin main

# Deletar branch local já mergeada
git branch -d feature/nome-descritivo

# Deletar todas as branches já mergeadas
git branch --merged | grep -v "main" | xargs git branch -d
```

---

## Situações Especiais

### Atualizar branch com mudanças de main

Se `main` foi atualizada enquanto você trabalha:

```bash
# Opção 1: Rebase (recomendado - histórico linear)
git checkout feature/sua-branch
git fetch origin
git rebase origin/main

# Opção 2: Merge
git checkout feature/sua-branch
git merge main
```

### Corrigir último commit

```bash
# Alterar mensagem do último commit
git commit --amend -m "Nova mensagem"

# Adicionar arquivo esquecido ao último commit
git add arquivo-esquecido.js
git commit --amend --no-edit

# ATENÇÃO: Só use --amend em commits que NÃO foram pushed!
```

### Desfazer mudanças

```bash
# Descartar mudanças não commitadas de um arquivo
git checkout -- arquivo.js

# Descartar todas as mudanças não commitadas
git reset --hard HEAD

# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Desfazer último commit (descarta mudanças)
git reset --hard HEAD~1
```

### Trabalhar em múltiplas features

```bash
# Salvar trabalho em progresso temporariamente
git stash

# Mudar de branch
git checkout outra-branch

# Voltar e recuperar trabalho
git checkout feature/original
git stash pop
```

---

## Boas Práticas

### Commits

✅ **BOM:**
```bash
git commit -m "fix: corrige cálculo de split em despesas manuais"
git commit -m "feat: adiciona autocomplete de aeroportos"
```

❌ **RUIM:**
```bash
git commit -m "mudanças"
git commit -m "wip"
git commit -m "fix bug"
```

### Branches

✅ **BOM:**
- `feature/google-oauth-integration`
- `fix/timezone-expense-dates`
- `hotfix/csrf-token-validation`

❌ **RUIM:**
- `bruno-changes`
- `temp`
- `fix`

### Pull Requests

✅ **BOM:**
- Título claro e conciso (< 70 caracteres)
- Descrição detalhada no corpo
- Screenshots de mudanças visuais
- Passos para testar bem definidos

❌ **RUIM:**
- "Mudanças diversas"
- PR sem descrição
- PR com 50+ arquivos alterados (quebrar em PRs menores)

---

## CI/CD Pipeline

O GitHub Actions roda automaticamente para:

- ✅ Todas as branches
- ✅ Todos os pull requests

**Pipeline atual** (`.github/workflows/ci.yml`):

1. Setup Node.js 18
2. Instalar dependências (`npm ci`)
3. Rodar testes unitários (`npm test`)
4. Rodar testes E2E (`npm run test:e2e`)

**Status do CI:**
- ✅ Verde = Pode mergear
- ❌ Vermelho = Corrigir antes de mergear

---

## Proteção de Branch (main)

### Configuração no GitHub

**Settings → Branches → Add rule para "main"**

✅ Configurações recomendadas:

- [x] Require pull request before merging
  - [x] Require approvals: 1 (quando tiver time)
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - [x] Status checks: `test` (do CI)
- [x] Include administrators (força regras para todos)
- [x] Restrict who can push (ninguém pode push direto)

### Verificar proteção

```bash
# Tentar push direto (deve falhar se protegida)
git checkout main
git push
# Erro: "main is protected"
```

---

## Referências

- [GitHub Flow Guide](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Best Practices](https://git-scm.com/book/en/v2)

---

## Contato

Dúvidas sobre o workflow? Entre em contato:

**Bruno Pinto Brum**
brunobrum@gmail.com | +1 (514) 926-9447
