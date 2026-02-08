# Guia: Renomear master → main

## Por que renomear?

- ✅ **Convenção moderna:** GitHub usa `main` como padrão desde 2020
- ✅ **Alinhamento com indústria:** Maioria dos projetos migrou
- ✅ **Melhor semântica:** Nome mais neutro e descritivo
- ✅ **Profissionalismo:** Mostra que projeto está atualizado

---

## Processo completo

### Opção 1: Via GitHub UI (Mais Simples)

#### Passo 1: Renomear no GitHub

1. Vá em: https://github.com/seu-usuario/orlando-2026
2. Settings → Branches
3. Clique no ícone de lápis ao lado de `master`
4. Digite `main`
5. Clique em "Rename branch"

GitHub automaticamente:
- Renomeia a branch
- Atualiza branch padrão
- Mostra instruções para atualizar localmente

#### Passo 2: Atualizar repositório local

```bash
# Baixar a branch renomeada
git fetch origin

# Mudar para a nova branch main
git checkout -b main origin/main

# Configurar upstream
git branch -u origin/main

# Deletar master local
git branch -D master
```

#### Passo 3: Atualizar referências

```bash
# Se tiver outros clones do repositório:
cd outro-clone
git fetch origin
git checkout main
git branch -D master
```

---

### Opção 2: Via Linha de Comando (Mais Controle)

#### Passo 1: Renomear localmente

```bash
# Certifique-se de estar em master
git checkout master

# Renomear master → main localmente
git branch -m master main

# Push da nova branch
git push -u origin main
```

#### Passo 2: Atualizar branch padrão no GitHub

**Via GitHub UI:**
1. Settings → Branches → Default branch
2. Clique no ícone de switch
3. Selecione `main`
4. Clique em "Update"
5. Confirme a mudança

**Via gh CLI (alternativa):**
```bash
gh repo edit --default-branch main
```

#### Passo 3: Deletar master remota

```bash
# Certifique-se de que main é a padrão no GitHub!
git push origin --delete master
```

#### Passo 4: Atualizar proteções (se existirem)

Se você tinha proteções em `master`:

1. Settings → Branches
2. Copie as regras de `master` para `main`
3. Delete a regra de `master`

---

## Atualizar CI/CD

Seu `.github/workflows/ci.yml` já está configurado para todas as branches:

```yaml
on:
  push:
    branches: [ "**" ]  # ✅ Já funciona!
  pull_request:
    branches: [ "**" ]  # ✅ Já funciona!
```

**Nenhuma alteração necessária!** Mas se quiser especificar `main`:

```yaml
on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
```

---

## Verificação pós-migração

Execute estes comandos para verificar:

```bash
# 1. Confirmar branch atual
git branch
# Esperado: * main

# 2. Verificar upstream
git branch -vv
# Esperado: * main ... [origin/main] ...

# 3. Confirmar branch padrão no GitHub
gh repo view --json defaultBranchRef
# Esperado: "name": "main"

# 4. Verificar que master foi deletada
git branch -a
# Esperado: NÃO deve aparecer master
```

---

## Atualizar documentação

### 1. README.md

Procure por referências a `master` e substitua por `main`:

```bash
# Buscar referências
grep -r "master" README.md docs/

# Exemplos de mudanças:
- git clone https://github.com/user/repo.git
- cd repo
- git checkout master  ← MUDAR PARA: git checkout main
```

### 2. Scripts e configs

Verifique arquivos que possam referenciar `master`:

```bash
# Buscar em todo o projeto
grep -r "master" --exclude-dir=node_modules --exclude-dir=.git .
```

---

## Impacto em integrações

### GitHub Actions
✅ **Sem impacto** - Workflows já configurados para todas as branches

### Clones existentes
⚠️ **Requer atualização** - Siga "Passo 2" da Opção 1 acima

### Colaboradores
⚠️ **Avisar equipe** - Envie instruções de atualização

### Hospedagem (Cloudflare Tunnel, VPS, etc)
⚠️ **Atualizar deploy scripts** se eles fazem `git pull origin master`

Exemplo de ajuste:
```bash
# Deploy script antigo:
git pull origin master

# Atualizar para:
git pull origin main
```

---

## Rollback (se necessário)

Se algo der errado, você pode reverter:

```bash
# Renomear de volta
git branch -m main master
git push -u origin master

# Atualizar default no GitHub
gh repo edit --default-branch master

# Deletar main
git push origin --delete main
```

**Mas isso é raro!** A migração é segura se seguir os passos.

---

## Timeline recomendada

### Para seu projeto (desenvolvimento solo):

```
Dia 0:
  ✅ Renomear master → main (Opção 1 ou 2)
  ✅ Atualizar clone local
  ✅ Commit de atualização de docs

Dia 1:
  ✅ Verificar CI funcionando
  ✅ Testar workflow com PR de teste
  ✅ Configurar proteção de branch (docs/BRANCH_PROTECTION.md)

Dia 2+:
  ✅ Usar novo workflow normalmente
  ✅ Criar PRs para features
```

---

## Checklist final

Após migração, confirme:

- [ ] Branch `main` existe localmente
- [ ] Branch `main` existe no GitHub
- [ ] `main` é a branch padrão no GitHub (Settings → Branches)
- [ ] Branch `master` foi deletada (local e remoto)
- [ ] CI/CD continua funcionando
- [ ] Clone local aponta para `origin/main`
- [ ] Documentação atualizada (README, etc)
- [ ] Scripts de deploy atualizados (se aplicável)

---

## Pronto para começar?

Execute os comandos da **Opção 1** (mais simples) ou **Opção 2** (mais controle).

Qualquer dúvida, consulte:
- [GitHub Renaming Guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch)
