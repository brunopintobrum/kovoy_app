# ✅ Próximos Passos - Migração master → main

## Status Atual

✅ **CONCLUÍDO:**
- [x] Branch `main` criada localmente
- [x] Branch `main` enviada ao GitHub
- [x] Documentação de workflow criada
- [x] Template de PR configurado
- [x] Guias de proteção de branch criados

⚠️ **PENDENTE (requer ação manual no GitHub):**
- [ ] Alterar branch padrão no GitHub de `master` para `main`
- [ ] Deletar branch `master` remota
- [ ] (Opcional) Configurar proteção de branch `main`

---

## Passo 1: Alterar branch padrão no GitHub

### Via GitHub UI (Recomendado):

1. Acesse: https://github.com/brunopintobrum/kovoy_app/settings/branches

2. Na seção **"Default branch"**, você verá `master`

3. Clique no ícone de **switch** (duas setas) ao lado de `master`

4. Selecione `main` no dropdown

5. Clique em **"Update"**

6. Confirme clicando em **"I understand, update the default branch"**

7. ✅ Pronto! Agora `main` é a branch padrão

---

## Passo 2: Deletar branch master remota

**IMPORTANTE:** Só faça isso DEPOIS de completar o Passo 1!

### Via terminal:

```bash
git push origin --delete master
```

### Via GitHub UI (alternativa):

1. Vá em: https://github.com/brunopintobrum/kovoy_app/branches

2. Encontre `master` na lista

3. Clique no ícone de **lixeira** ao lado de `master`

4. Confirme a deleção

---

## Passo 3: Verificar que tudo funcionou

Execute no terminal:

```bash
# Verificar branches locais
git branch
# Esperado: * main

# Verificar branches remotas
git branch -r
# Esperado: origin/HEAD -> origin/main, origin/main (SEM origin/master)

# Verificar status
git status
# Esperado: On branch main, Your branch is up to date with 'origin/main'
```

---

## Passo 4 (OPCIONAL mas RECOMENDADO): Configurar proteção de branch

Siga o guia completo em: [`docs/BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md)

**Resumo rápido:**

1. Acesse: https://github.com/brunopintobrum/kovoy_app/settings/branches

2. Clique em **"Add branch protection rule"**

3. **Branch name pattern:** `main`

4. **Configure:**
   - ☑ Require a pull request before merging
   - ☑ Require status checks to pass before merging
     - ☑ test (do GitHub Actions)
   - ☑ Do not allow bypassing the above settings
   - ☑ Include administrators

5. Clique em **"Create"**

---

## Passo 5: Testar novo workflow

Teste criando uma PR de exemplo:

```bash
# Criar branch de teste
git checkout -b test/novo-workflow

# Fazer pequena mudança
echo "# Teste de workflow" >> docs/teste.md
git add docs/teste.md
git commit -m "test: verifica novo workflow com PR"

# Push
git push -u origin test/novo-workflow

# Abrir PR no GitHub
# https://github.com/brunopintobrum/kovoy_app/compare/test/novo-workflow
```

**O que vai acontecer:**
1. GitHub vai mostrar o template de PR automaticamente
2. CI vai rodar os testes automaticamente
3. Você vai ver se a proteção está funcionando (se configurou)
4. Faça merge via PR (botão verde)
5. Delete a branch após merge

---

## Checklist Final

Marque conforme for completando:

- [ ] Passo 1: Branch padrão alterada para `main` no GitHub
- [ ] Passo 2: Branch `master` deletada do remoto
- [ ] Passo 3: Verificação executada (comandos acima)
- [ ] Passo 4: Proteção de branch configurada (opcional)
- [ ] Passo 5: PR de teste criada e mergeada com sucesso

---

## Troubleshooting

### "Não consigo alterar a branch padrão"

**Possível causa:** Você não é admin do repositório

**Solução:** Verifique suas permissões em Settings → Manage access

### "master ainda aparece em git branch -r"

**Causa:** Cache local

**Solução:**
```bash
git fetch --prune origin
git remote prune origin
```

### "CI não está rodando na PR de teste"

**Verifique:**
1. Actions estão habilitadas? Settings → Actions → "Allow all actions"
2. `.github/workflows/ci.yml` existe?
3. Workflow tem trigger correto:
   ```yaml
   on:
     push:
       branches: [ "**" ]
     pull_request:
       branches: [ "**" ]
   ```

---

## Quando tudo estiver pronto

Você estará usando oficialmente **GitHub Flow**! 🎉

**Seu novo workflow diário:**

```bash
# 1. Nova feature
git checkout main
git pull origin main
git checkout -b feature/minha-feature

# 2. Desenvolver
# ... código ...
git add .
git commit -m "feat: adiciona nova funcionalidade"

# 3. Push
git push -u origin feature/minha-feature

# 4. Abrir PR no GitHub
# - Template automático aparece
# - CI roda automaticamente
# - Merge via botão verde

# 5. Atualizar main local
git checkout main
git pull origin main
git branch -d feature/minha-feature
```

**Documentação completa:** [`docs/GIT_WORKFLOW.md`](GIT_WORKFLOW.md)

---

## Dúvidas?

- 📖 Guia de workflow: `docs/GIT_WORKFLOW.md`
- 🛡️ Proteção de branch: `docs/BRANCH_PROTECTION.md`
- 🔄 Detalhes da migração: `docs/RENAME_MASTER_TO_MAIN.md`

**Contato:**
Bruno Pinto Brum | brunobrum@gmail.com | +1 (514) 926-9447
