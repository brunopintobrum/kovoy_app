# AGENTS.md

## Contexto obrigatorio
- Leia `CONTEXT.md` antes de qualquer tarefa.
- O template Skote em `D:\ChatGPT\Skote_Asp.net_v3.2.0\Skote Asp.net Core\Skote` e a fonte da verdade para UI/UX e padroes.
- Campos obrigatorios no cadastro: email, first name, last name, password, confirm password.
- Padrao de idioma da UI: ingles nas paginas do painel e menus.
- Preferencia de fluxo: quando houver escolha A/P, o assistente seleciona automaticamente sem perguntar.

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
- Voos V2: novos campos (flight number, class, status), assentos/bagagens por passageiro via vinculo a participantes, e autocomplete de aeroportos (From/To).
- Voos V2: chegada sincroniza com a partida no formulario.
- Schema: tabela group_flight_participants para vinculo de passageiros nos voos.
- Testes: validacoes e integracao para voos V2.
- Voos V2 (proximos): validar chegada > partida, exibir classe/assento/bagagem na lista, seletor de passageiros com busca.
- Hospedagens V2: endereco completo + contato, quartos, check-in/out com hora e status.
- Schema: novos campos em group_lodgings para endereco, horarios, quartos e status.
- Hospedagens V2: UI sincroniza check-out com check-in quando o campo esta vazio.
- Hospedagens V2: backend valida check-out posterior ao check-in.
- Transportes V2: origem/destino, datas/horas, fornecedor/localizador, status e observacoes.
- Transportes V2: validacao de chegada posterior a partida no backend.
- Transportes V2: UI valida chegada posterior a partida.
- Transportes V2: UI sincroniza chegada com partida quando o campo esta vazio.
- Schema: novos campos em group_transports para origem/destino, datas/horas, fornecedor/localizador e status.
- Testes: validacao de transportes V2.
- Modulos V2 sincronizam pagador, tipo/mode e alvos do split (Participants/Families/manual) diretamente na despesa vinculada; o detail permanece no `expense_splits`.
- Tickets V2: tipo, data/hora, local, status e vinculo a participantes.
- Schema: novos campos em group_tickets e tabela group_ticket_participants.
- Testes: validacao de tickets V2.
- Tickets V2: backend valida data/hora futura quando status=planned.
- Hospedagens V2: UI valida check-out posterior ao check-in.
- Tickets V2: UI valida data/hora futura quando status=planned.
- Voos V2: input Airline agora usa datalist/api e grava `airline_id`, criando novas companhias se necessário para evitar digitação incorreta e garantir consistência.
- Route filtering: backend consegue filtrar os nomes por From/To usando os scripts `import-routes.js` (routes + airports) e o endpoint `/api/routes/airlines`.
- Hospedagens V2: campo Property com datalist das propriedades mais usadas + fallback fixo via `/api/groups/:groupId/lodging-properties`.
- Hospedagens V2: Country select com sugestoes de City/State por pais (historico + fallback) via `/api/groups/:groupId/lodging-locations`.
- Localizacoes: endpoints `/api/locations/countries`, `/api/locations/states`, `/api/locations/cities` para Country/City/State.
- Localizacoes: base oficial (GeoNames) com scripts `scripts/download-geonames.ps1` e `scripts/convert-geonames-to-locations.js`.
- Hospedagens V2: formulario reorganizado em blocos (Location, Dates & Status, Rooms, Contact).
- Dashboard: resumo separado da gestao em `/dashboard` e gestao completa em `/group-details`.
- Dashboard: menu lateral direciona para secoes individuais via hash (mostra apenas o modulo selecionado).
- Grupos: modo de saldo familiar configuravel por grupo (participants/families).
- Membros: opcao para sair do grupo (exceto owner).
- Avatar: imagem padrao neutra (SVG) substituiu avatares aleatorios.
- Avatar: modal de upload/troca de foto em todas as paginas (groups, group, group-details, dashboard).
- Email: suporte a Mailgun (SMTP) para verificacao e reset de senha.
- Deploy: documentacao de Cloudflare Tunnel para expor servidor local.

