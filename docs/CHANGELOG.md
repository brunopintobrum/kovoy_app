# CHANGELOG

Histórico consolidado de atualizações do projeto Orlando 2026.

## Atualizações Recentes

### Dependências e Segurança
- Dependências de upload e email atualizadas: multer 2.x e nodemailer 7.x
- `npm audit fix --force` aplicado para zerar vulnerabilidades
- `npm test` executado com sucesso

### Autenticação e Perfil
- Avatar: imagem padrão neutra (SVG) para novos usuários
- Avatar: modal de upload/troca de foto em todas as páginas
- Email: configuração de Mailgun documentada

### Grupos e Membros
- Fluxo de grupos no painel fechado com validações e convites
- Validação da soma do split e testes de convites adicionados
- Membros: opção para sair do grupo (exceto owner)
- Grupos: modo de saldo familiar configurável por grupo (participants/families)

### Despesas
- Despesas: edição no painel (UI)
- Split manual de despesas implementado (V1.1)
- Validação da soma do split implementada
- UI: toggle para vincular despesas nos módulos (V2 opcional)

### Módulos Logísticos (V2)
- API de módulos por grupo (voos, hospedagens, transportes, tickets) adicionada
- CRUD no dashboard para voos, hospedagens, transportes e tickets
- Base V2: módulos aceitam vínculo opcional de despesa (expense_id)
- Módulos V2 sincronizam o pagador e o split (participants/families/manual) do painel diretamente na despesa vinculada

### Voos V2
- Novos campos: flight number, class, status, assentos/bagagens por passageiro
- Autocomplete de aeroportos (From/To)
- Chegada sincroniza com a partida no formulário
- Campo Airline usa autocomplete/datalist via `/api/airlines`, registra `airline_id`
- Schema: tabela `group_flight_participants` para vínculo de passageiros
- Validações e integração para voos V2 com testes

### Hospedagens V2
- Endereço completo + contato, quartos, check-in/out com hora e status
- Property com datalist das propriedades mais usadas + fallback fixo via `/api/groups/:groupId/lodging-properties`
- Country select com sugestões de City/State por país via `/api/groups/:groupId/lodging-locations`
- Formulário reorganizado em blocos (Location, Dates & Status, Rooms, Contact)
- UI sincroniza check-out com check-in quando o campo está vazio
- Backend valida check-out posterior ao check-in
- Novos campos em `group_lodgings` para endereço, horários, quartos e status

### Transportes V2
- Origem/destino, datas/horas, fornecedor/localizador, status e observações
- Validação de chegada posterior a partida no backend
- UI valida chegada posterior a partida
- UI sincroniza chegada com partida quando o campo está vazio
- Novos campos em `group_transports`

### Tickets V2
- Tipo, data/hora, local, status e vínculo a participantes
- Schema: nova tabela `group_ticket_participants`
- Backend valida data/hora futura quando status=planned
- UI valida data/hora futura quando status=planned
- Validações com testes

### Localizações e Dados
- Endpoints `/api/locations/countries`, `/api/locations/states`, `/api/locations/cities`
- Base oficial (GeoNames) convertida/importada via scripts
- Scripts: `download-geonames.ps1` e `convert-geonames-to-locations.js`

### Dashboard e UI
- Dashboard: resumo separado da gestão em `/dashboard` vs gestão completa em `/group-details`
- Dashboard: menu lateral direciona para seções individuais via hash (mostra apenas o módulo selecionado)
- Modo de saldo familiar configurável por grupo

### Infraestrutura e Deploy
- Playwright E2E e pipeline CI adicionados
- E2E atualizado para fluxo de grupos com webserver dedicado
- Deploy: Cloudflare Tunnel como opção para expor servidor local

---

## Notas

- Consolidação de atualizações removidas de CONTEXT.md, AGENTS.md, README.md e docs/README.md (2026-03-23)
- Para histórico detalhado de commits, veja `git log`
