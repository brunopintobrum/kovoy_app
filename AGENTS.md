# AGENTS.md

## Contexto obrigatorio
- Leia `CONTEXT.md` antes de qualquer tarefa.
- O template Kovoy em `F:\OneDrive\PCTECH\Kovoy_Asp.net_v3.2.0\Kovoy Asp.net Core\Kovoy` e a fonte da verdade para UI/UX e padroes.
- Campos obrigatorios no cadastro: email, first name, last name, password, confirm password.
- Padrao de idioma da UI: ingles nas paginas do painel e menus.

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
- Quando o usuario pedir commit e push, executar ambos diretamente sem solicitar confirmacao adicional.

## Atualizacoes recentes
- Dependencias de upload e email atualizadas: multer 2.x e nodemailer 7.x.
- `npm audit fix --force` aplicado para zerar vulnerabilidades.
- `npm test` executado com sucesso.

