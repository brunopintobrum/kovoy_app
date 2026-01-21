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

## Regras de negocio (MVP)
- [x] Tudo pertence a um groupId
- [x] User pode estar em varios grupos
- [x] GroupMember com roles (owner/admin/member/viewer)
- [x] Participant pode existir sem login
- [x] Family e agrupador de participants
- [x] Despesa tem pagador + split
- [x] Split soma exatamente o total (validacao e teste dedicado)

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

## Testes
- [x] Split por pessoa (unit)
- [x] Split por familia (unit)
- [x] Validacao de soma do split (unit)
- [x] Saldo por participant (unit)
- [x] Quem deve pra quem (unit)
- [x] Convite expira (integration)
- [x] Convite nao pode ser reutilizado (integration)

## V2 (fora do MVP)
- [ ] Voos, hospedagens, transporte e tickets (CRUD simples por grupo)
- [ ] Anexos/recibos
- [ ] Categorias avancadas e filtros
- [ ] Multi-moeda e cambio
- [ ] Notificacoes e integracoes
