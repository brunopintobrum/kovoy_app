# AGENTS.md

## Contexto obrigatorio
- Leia `CONTEXT.md` antes de qualquer tarefa.
- O template Skote em `F:\OneDrive\PCTECH\Skote_Asp.net_v3.2.0\Skote Asp.net Core\Skote` e a fonte da verdade para UI/UX e padroes.
- Campos obrigatorios no cadastro: email, first name, last name, password, confirm password.

## Dev environment tips
- Use `npm start` para subir o servidor local.
- Use `npm test` para rodar a suite de testes.

## Testing instructions
- Execute `npm test` antes de commitar.
- Se houver travamento no Windows, rode `npm test -- --runInBand`.
- Atualize/adicione testes quando alterar comportamento de cadastro/autenticacao.

## PR instructions
- Commits e mensagens em pt-BR.
- Verifique `git status -sb` antes de commitar.
