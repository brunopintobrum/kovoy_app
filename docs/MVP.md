# MVP Checklist - Group Trip App

## Escopo do MVP
- [x] Autenticacao base (email/senha, Google OAuth opcional)
- [x] Isolamento por groupId (base de groups/members)
- [x] Familias e participantes
- [ ] Despesas
- [ ] Split de despesas (igual por pessoa / igual por familia)
- [ ] Dashboard de saldos (por participant e por familia)
- [ ] Quem deve pra quem (algoritmo simples)

## Modulos e APIs
- [x] Grupos
  - [x] Criar grupo
  - [x] Listar meus grupos
- [x] Convites
  - [x] Criar convite
  - [x] Aceitar convite
- [x] Membros
  - [x] Listar membros do grupo
- [x] Familias
  - [x] Criar familia
  - [x] Editar familia
  - [x] Listar familias
  - [x] Remover familia (bloqueia se houver participantes)
- [x] Participantes
  - [x] Criar participante
  - [x] Editar participante
  - [x] Listar participantes
  - [x] Remover participante
- [ ] Despesas
  - [ ] Criar despesa
  - [ ] Editar despesa
  - [ ] Listar despesas
  - [ ] Remover despesa
  - [ ] Split por pessoa
  - [ ] Split por familia

## UI (Skote)
- [ ] Tela "Meus grupos"
- [ ] Tela "Grupo" (familias e participantes)
- [ ] Tela "Despesas"
- [ ] Dashboard do grupo

## Testes
- [ ] Split por pessoa
- [ ] Split por familia
- [ ] Saldo por participant
- [ ] Quem deve pra quem
- [ ] Convite expira/nao pode ser reutilizado

## V2 (fora do MVP)
- [ ] Voos, hospedagens, transporte e tickets (CRUD simples por grupo)
- [ ] Anexos/recibos
- [ ] Categorias avancadas e filtros
- [ ] Multi-moeda e cambio
- [ ] Notificacoes e integracoes
