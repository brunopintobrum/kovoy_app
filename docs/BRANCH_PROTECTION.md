# Configuração de Proteção de Branch

## Quando configurar?

Configure a proteção da branch `main` quando:

- ✅ Você estiver pronto para ir para produção
- ✅ Tiver colaboradores no projeto
- ✅ Quiser garantir que testes sempre passem antes do merge

**Para desenvolvimento solo atual:** Opcional, mas recomendado para criar bom hábito.

---

## Passo a Passo (GitHub)

### 1. Acesse as configurações do repositório

```
https://github.com/seu-usuario/orlando-2026/settings/branches
```

Ou navegue:
1. Vá no repositório no GitHub
2. Settings (topo direito)
3. Branches (menu lateral esquerdo)

### 2. Adicione regra para branch `main`

Clique em **"Add branch protection rule"**

**Branch name pattern:** `main`

### 3. Configure as proteções recomendadas

#### Nível 1: Básico (Recomendado para agora)

```
☑ Require a pull request before merging
  ☑ Require approvals: 0 (você está sozinho)
  ☐ Dismiss stale pull request approvals (opcional)

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks que devem passar:
    ☑ test (do GitHub Actions CI)
    ☑ e2e-tests (se configurado)

☐ Require conversation resolution (opcional)

☑ Do not allow bypassing the above settings
  ☑ Include administrators (força para você também)
```

#### Nível 2: Produção (Quando tiver deploy)

Adicione ao Nível 1:

```
☑ Require deployments to succeed before merging
  Selecione: production

☑ Require signed commits (se usar GPG)

☑ Restrict who can push to matching branches
  (Deixe vazio - ninguém pode push direto)
```

#### Nível 3: Equipe (Quando tiver colaboradores)

Adicione ao Nível 2:

```
☑ Require a pull request before merging
  ☑ Require approvals: 1 (ou 2 para projetos críticos)
  ☑ Dismiss stale pull request approvals
  ☑ Require review from Code Owners

☑ Require conversation resolution before merging

☑ Lock branch (impede qualquer push)
```

### 4. Salve a configuração

Clique em **"Create"** no final da página.

---

## Verificar se está funcionando

### Teste 1: Push direto (deve falhar)

```bash
git checkout main
echo "teste" >> README.md
git add README.md
git commit -m "test: tentativa de push direto"
git push

# Esperado:
# remote: error: GH006: Protected branch update failed for refs/heads/main.
# remote: error: Cannot push to branch
```

### Teste 2: Via PR (deve funcionar)

```bash
git checkout -b test/protecao-branch
git push -u origin test/protecao-branch

# Abra PR no GitHub
# CI deve rodar automaticamente
# Só poderá mergear quando CI passar
```

---

## Configuração atual do CI

Seu arquivo `.github/workflows/ci.yml` já roda automaticamente em:

- ✅ Todas as branches
- ✅ Todos os pull requests

**Jobs que rodam:**
1. `npm ci` (instala dependências)
2. `npm test` (testes unitários/integração)
3. `npx playwright install` (instala browsers)
4. `npm run test:e2e` (testes end-to-end)

**Status checks disponíveis para proteção:**
- Nome do job: `test` (ou o nome definido no workflow)

---

## Remover proteção (se necessário)

Se precisar remover temporariamente:

1. Settings → Branches
2. Encontre a regra de `main`
3. Clique em **Delete** (ícone de lixeira)

---

## Configuração via CLI (Alternativa)

Se preferir usar linha de comando com `gh` CLI:

```bash
# Instalar gh CLI (se não tiver)
# Windows: winget install GitHub.cli
# Mac: brew install gh

# Autenticar
gh auth login

# Criar proteção básica
gh api repos/seu-usuario/orlando-2026/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["test"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":0}' \
  -f restrictions=null

# Ver configuração atual
gh api repos/seu-usuario/orlando-2026/branches/main/protection
```

---

## Recomendação para seu projeto

### Fase atual (Desenvolvimento solo):

```
✅ Require pull request before merging (sem approvals)
✅ Require status checks to pass (CI tests)
✅ Include administrators (força para você)
❌ Approvals (você está sozinho)
❌ Code owners (não necessário)
```

### Quando for para produção:

```
✅ Todas as anteriores +
✅ Require deployments to succeed
✅ Restrict pushes (ninguém)
✅ Require signed commits (segurança extra)
```

### Quando tiver colaboradores:

```
✅ Todas as anteriores +
✅ Require 1+ approvals
✅ Dismiss stale reviews
✅ Require conversation resolution
```

---

## Benefícios imediatos

Mesmo trabalhando sozinho, proteção de branch garante:

- ✅ Nunca quebrar `main` acidentalmente
- ✅ CI sempre roda antes do merge
- ✅ Histórico limpo via PRs
- ✅ Rastreabilidade de mudanças
- ✅ Hábito profissional desde o início

---

## Troubleshooting

### "Não consigo fazer merge mesmo com CI verde"

Verifique:
- Status check configurado existe no CI? (nome correto)
- Branch está atualizada com `main`?
- Todos os checks obrigatórios passaram?

### "Preciso fazer hotfix urgente mas branch está protegida"

**Opção 1 (Recomendado):**
```bash
git checkout -b hotfix/urgente
# fix
git push -u origin hotfix/urgente
# PR → habilite "auto-merge" → mergea quando CI passar
```

**Opção 2 (Emergência extrema):**
- Settings → Branches → Desabilite "Include administrators"
- Push direto
- Reabilite proteção depois

### "CI não está rodando no PR"

Verifique:
- `.github/workflows/ci.yml` existe?
- Workflow tem `on: [push, pull_request]`?
- Actions estão habilitadas no repo? (Settings → Actions)

---

## Referências

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Required Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
- [GitHub CLI - Branch Protection](https://cli.github.com/manual/gh_api)

---

**Próximos passos:**

1. [ ] Configure proteção básica (Nível 1)
2. [ ] Teste workflow com PR de exemplo
3. [ ] Atualize para Nível 2 antes do deploy
4. [ ] Documente no onboarding quando tiver equipe
