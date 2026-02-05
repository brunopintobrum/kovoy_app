# MVP Checklist - Group Trip App

## Objetivo do MVP
- [x] Base de autenticacao (email/senha; Google OAuth opcional)
- [x] Estrutura multi-grupo (groupId em todas as entidades)
- [x] Familias e participantes (pessoas podem existir sem login)
- [x] Despesas com split igual por pessoa e por familia
- [x] Dashboard de saldos e "quem deve pra quem" (backend)

## Modulos do sistema
- [x] Auth
  - [x] Register/Login (email/senha)
  - [x] Google OAuth opcional
- [x] Grupos
  - [x] Criar grupo (nome, moeda)
  - [x] Listar meus grupos
  - [x] Membership por groupId
  - [x] Selecionar grupo ativo (UI)
- [x] Convites
  - [x] Criar convite (email + role)
  - [x] Aceitar convite
- [x] Expiracao aplicada no endpoint
- [x] Bloqueio de reuso do convite
- [x] Participantes
  - [x] Criar familia
  - [x] Editar familia
  - [x] Listar familias
  - [x] Remover familia (bloqueia se houver participantes)
  - [x] Criar participant com familia
  - [x] Criar participant sem familia
  - [x] Editar participant (nome, tipo, familia)
  - [x] Listar participants
  - [x] Remover participant
- [x] Despesas
  - [x] Criar despesa (valor, descricao, data, categoria)
  - [x] Editar despesa (UI)
  - [x] Editar despesa
  - [x] Listar despesas
  - [x] Remover despesa
  - [x] Selecionar pagador (payerParticipantId)
- [x] Split igual por pessoa
- [x] Split igual por familia
- [x] Split manual (V1.1)
- [x] Dashboard
  - [x] Total do grupo (UI)
  - [x] Saldo por participant (backend)
  - [x] Saldo por familia (backend)
  - [x] Lista "quem deve pra quem" (backend)
  - [x] Modo de saldo familiar por grupo (participants/families)
  - [x] Dashboard separado da gestao (resumo apenas)
  - [x] Navegacao por secao (hash) para focar um modulo por vez

## Regras de negocio (MVP)
- [x] Tudo pertence a um groupId
- [x] User pode estar em varios grupos
- [x] GroupMember com roles (owner/member/viewer)
- [x] Participant pode existir sem login
- [x] Family e agrupador de participants
- [x] Despesa tem pagador + split
- [x] Split soma exatamente o total (validacao e teste dedicado)
- [x] Pagamentos e divisao sao registrados apenas em Expenses (modulos V2 sao logísticos)

## Modelo de dados (MVP)
- [x] User
- [x] Group
- [x] GroupMember
- [x] Invitation
- [x] Family
- [x] Participant
- [x] Expense
- [x] ExpenseSplit

## Fluxos principais
- [x] Fluxo A: Criar grupo e cair no dashboard do grupo
- [x] Fluxo B: Convidar e entrar no grupo
- [x] Fluxo C: Montar familias e participantes
- [x] Fluxo D: Criar despesa e dividir
- [x] Fluxo E: Ver saldos e "quem deve pra quem" (backend)

## UI (Skote)
- [x] Tela "Meus grupos"
  - [x] Criar grupo
  - [x] Entrar por convite
  - [x] Listar grupos do usuario
- [x] Tela "Grupo"
  - [x] Bloco de participantes/familias
  - [x] Bloco de despesas
  - [x] Bloco de dashboard
- [x] Dashboard do grupo
  - [x] Cards de saldo
  - [x] Lista de dividas (quem deve pra quem)
  - [x] Resumo separado da pagina de gestao
  - [x] Menu lateral direciona para secao unica por vez

## Testes
- [x] Voos V2 (validation/integration)
- [x] Transportes V2 (validation)
- [x] Tickets V2 (validation)
- [x] Split por pessoa (unit)
- [x] Split por familia (unit)
- [x] Validacao de soma do split (unit)
- [x] Saldo por participant (unit)
- [x] Quem deve pra quem (unit)
- [x] Convite expira (integration)
- [x] Convite nao pode ser reutilizado (integration)

## V2 (fora do MVP)
- [x] Voos, hospedagens, transporte e tickets (CRUD simples por grupo)
- [ ] Modulos V2 (detalhes e usabilidade)
  - [x] Voos
    - [x] Companhia, numero do voo, PNR
    - [x] Assentos, classe, bagagens
    - [x] Assentos por passageiro
    - [x] Bagagens por passageiro
    - [x] Status (planned/paid/due) e observacoes
    - [x] Integracao com passageiros (participantes)
    - [x] Autocomplete (datalist) para airline com fallback para adicionar novas cias e `airlines`.
    - [x] Autocomplete de aeroportos (From/To) com `/api/airports`.
    - [x] Filter por rota (From/To) usando tabela de rotas/aeroportos.
    - [x] Validar chegada posterior a partida (backend + UI)
    - [x] UI: chegada sincroniza com a partida no formulario
    - [x] Exibir classe/assento/bagagem na lista
    - [x] Seletor de passageiros com busca
    - [x] Layout de voos reorganizado (secoes e tabela de detalhes por passageiro)
    - [ ] UX: filtros por cia/rota/status
    - [ ] Dados: prefilling por airline + flight number
  - [x] Hospedagens
    - [x] Quartos (tipo, quantidade, ocupacao)
    - [x] Endereco completo + contato
    - [x] Check-in/out com hora
    - [x] Status e observacoes
    - [x] Autocomplete (datalist) para Property com historico + fallback fixo
    - [x] Country select + sugestoes de City/State por pais (historico + fallback)
    - [x] Base oficial de localizacoes (countries/states/cities) via `/api/locations/*`
    - [x] Importacao GeoNames para popular countries/states/cities
    - [x] UI: check-out sincroniza com check-in quando o campo esta vazio
    - [x] Validar check-out > check-in (backend)
    - [x] Validar check-out > check-in (UI)
    - [x] Listagem: resumo de quartos e status
    - [ ] Filtros por cidade/status
    - [ ] Dados: contato obrigatorio quando necessario
  - [x] Transportes
    - [x] Origem/destino, datas/horas
    - [x] Fornecedor, localizador
    - [x] Status e observacoes
    - [x] Validar chegada > partida (backend)
    - [x] Validar chegada > partida (UI)
    - [x] UI: chegada sincroniza com partida quando o campo esta vazio
    - [x] Listagem: origem/destino + horario em destaque
    - [ ] Filtros por status/fornecedor
    - [ ] Dados: provider + locator obrigatorios quando status=paid
  - [x] Tickets
    - [x] Tipo (parque, evento, etc), data/hora, local
    - [x] Vinculo a participantes
    - [x] Status e observacoes
    - [x] Validar data/hora coerente (backend)
    - [x] Validar data/hora coerente (UI)
    - [x] Listagem: participantes destacados
    - [ ] Filtros por tipo/status/data
    - [ ] Dados: local obrigatorio quando type exige
  - [x] Unificar custos com Expenses (pagador + split dentro do modulo) *(panel split agora reaproveitado automaticamente nos módulos logísticos)*
  - [ ] Anexos/recibos por item (upload, visualizacao e download)
  - [x] Autocomplete/validacao para hospedagens (Country + City/State + Property)
  - [ ] Autocomplete/validacao para transportes (origem/destino)
  - [ ] Autocomplete/validacao para tickets (local)
- [x] Confirmacao antes de deletar (todos os modulos)
- [x] Toast de feedback apos salvar/deletar nos modulos
- [x] Desabilitar botoes durante requisicoes API (prevenir duplicatas)
- [ ] Indicador visual de expense vinculada nas listagens dos modulos
- [ ] Ordenacao por coluna nas tabelas (client-side)
- [ ] Estado vazio com CTA nos modulos
- [ ] Listagens responsivas (mobile) em group-details
- [ ] Categorias avancadas e filtros (por data, status, responsavel)
- [ ] Multi-moeda e cambio (taxas por data + conversao no dashboard)
- [ ] Timeline do grupo (eventos e marcos por data)
- [ ] Notificacoes (email e in-app) para convites e alteracoes
- [ ] Importacao/exportacao (CSV e backup JSON)
- [ ] Auditoria e historico de edicoes
- [x] Vinculo opcional de despesa nos modulos (backend)
- [x] UI: toggle para vincular despesas nos modulos (V2 opcional)

## V2 - Prioridade sugerida
1. Voos V2: Validar chegada posterior a partida (backend + UI) [feito]
2. Transportes V2: Validar chegada > partida (backend feito, UI feito)
3. Hospedagens V2: Validar check-out > check-in (backend feito, UI feito)
4. Tickets V2: Validar data/hora coerente (backend feito, UI feito)
5. Voos V2: Exibir classe/assento/bagagem na lista [feito]
6. Voos V2: Seletor de passageiros com busca [feito]
7. Hospedagens V2: Listagem com resumo de quartos e status
8. Transportes V2: Listagem com origem/destino + horario em destaque
9. Tickets V2: Listagem com participantes destacados
10. Filtros: Voos por cia/rota/status [feito]
11. Filtros: Hospedagens por cidade/status [feito]
12. Filtros: Transportes por status/fornecedor [feito]
13. Filtros: Tickets por tipo/status/data [feito]
14. Voos V2: Prefilling por airline + flight number
15. Transportes V2: Provider + locator obrigatorios quando status=paid
16. Hospedagens V2: Contato obrigatorio quando necessario
17. Tickets V2: Local obrigatorio quando type exige
18. Voos V2: Autocomplete de aeroportos (From/To) e IDs persistidos [feito]
19. Voos V2: Assentos/bagagens por passageiro [feito]
20. Voos V2: Layout de formulario organizado [feito]
21. Confirmacao antes de deletar (todos os modulos) [feito]
22. Toast de feedback apos salvar/deletar nos modulos [feito]
23. Desabilitar botoes durante requisicoes API [feito]
24. Indicador visual de expense vinculada nas listagens
25. Ordenacao por coluna nas tabelas
26. Estado vazio com CTA nos modulos
27. Listagens responsivas (mobile) em group-details

## Funcionalidades de perfil
- [x] Avatar padrao neutro (SVG) para novos usuarios
- [x] Upload de foto de perfil (JPG, PNG, WEBP)
- [x] Modal de troca de foto em todas as paginas (groups, group, group-details, dashboard)
- [x] Membros podem sair do grupo (exceto owner)

## Infraestrutura
- [x] Suporte a Mailgun para envio de emails (verificacao, reset)
- [x] Documentacao de deploy com Cloudflare Tunnel

## V2 - Roadmap por fases
- V2.1 (Qualidade de dados)
  - Voos: chegada > partida (feito)
  - Transportes: chegada > partida (backend feito, UI feito)
  - Hospedagens: check-out > check-in (backend feito, UI feito)
  - Tickets: data/hora coerente (backend feito, UI feito)
- V2.2 (Listagens mais uteis)
  - Voos: classe/assento/bagagem na lista (feito)
  - Hospedagens: resumo de quartos e status (feito)
  - Transportes: origem/destino + horario em destaque (feito)
  - Tickets: participantes destacados (feito)
- V2.3 (Usabilidade de selecao e filtros)
  - Voos: seletor de passageiros com busca (feito)
  - Voos: filtros por cia/rota/status (feito)
  - Hospedagens: filtros por cidade/status (feito)
  - Transportes: filtros por status/fornecedor (feito)
  - Tickets: filtros por tipo/status/data (feito)
- V2.4 (Regras condicionais)
  - Voos: prefilling por airline + flight number
  - Transportes: provider + locator obrigatorios quando status=paid
  - Hospedagens: contato obrigatorio quando necessario
  - Tickets: local obrigatorio quando type exige
- V2.5 (Qualidade UX)
  - Confirmacao antes de deletar (todos os modulos)
  - Toast de feedback apos salvar/deletar nos modulos
  - Desabilitar botoes durante requisicoes API (prevenir duplicatas)
  - Indicador visual de expense vinculada nas listagens
  - Ordenacao por coluna nas tabelas (client-side)
  - Estado vazio com CTA nos modulos
  - Listagens responsivas (mobile) em group-details



