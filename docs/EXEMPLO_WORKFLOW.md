# Exemplo de Workflow

Este arquivo foi criado para demonstrar o workflow profissional de PRs.

## O que aconteceu:

1. ✅ Branch `test/exemplo-workflow` criada
2. ✅ Arquivo criado e commitado
3. ✅ Push para GitHub
4. ✅ PR aberta (você vai fazer isso)
5. ✅ CI roda automaticamente
6. ✅ Merge via interface do GitHub

## Próximos passos:

Após mergear esta PR:

1. Volte para `main`: `git checkout main`
2. Atualize: `git pull origin main`
3. Delete branch local: `git branch -d test/exemplo-workflow`

## Workflow diário recomendado:

```bash
# Sempre que for trabalhar em algo novo:
git checkout main
git pull origin main
git checkout -b feature/nome-descritivo

# Desenvolva...

git add .
git commit -m "feat: descrição clara"
git push -u origin feature/nome-descritivo

# Abra PR no GitHub → Aguarde CI → Merge
```

## Lembre-se:

Mesmo sem proteção técnica forçada, seguir este workflow traz:

- Histórico limpo
- CI validando mudanças
- Documentação via PRs
- Preparação para colaboradores futuros
- Hábitos profissionais
