# AGENTS.md

## Contexto obrigatorio
- Leia `CONTEXT.md` antes de qualquer tarefa.
- O template Skote em `D:\ChatGPT\Skote_Asp.net_v3.2.0\Skote Asp.net Core\Skote` e a fonte da verdade para UI/UX e padroes.
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
- Voos V2: novos campos (flight number, class, seat, baggage, status) e vinculo a participantes no modulo de grupos.
- Schema: tabela group_flight_participants para vinculo de passageiros nos voos.
- Testes: validacoes e integracao para voos V2.
- Voos V2 (proximos): validar chegada > partida, exibir classe/assento/bagagem na lista, seletor de passageiros com busca.
- Hospedagens V2: endereco completo + contato, quartos, check-in/out com hora e status.
- Schema: novos campos em group_lodgings para endereco, horarios, quartos e status.
- Transportes V2: origem/destino, datas/horas, fornecedor/localizador, status e observacoes.
- Schema: novos campos em group_transports para origem/destino, datas/horas, fornecedor/localizador e status.
- Testes: validacao de transportes V2.
- Tickets V2: tipo, data/hora, local, status e vinculo a participantes.
- Schema: novos campos em group_tickets e tabela group_ticket_participants.
- Testes: validacao de tickets V2.

