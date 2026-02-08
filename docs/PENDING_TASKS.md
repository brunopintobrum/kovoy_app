# Tarefas Pendentes - Orlando 2026

## 📋 Issues para Criar no GitHub

Este arquivo contém todas as tarefas pendentes organizadas por prioridade.
Copie e cole cada seção como uma nova issue no GitHub.

---

## 🔴 ALTA PRIORIDADE

### Issue 1: Configurar proteção de branch main no GitHub

**Labels:** `task`, `priority: high`

**Descrição:**
Configurar proteção de branch `main` para garantir que apenas código revisado e com CI passando seja mergeado.

**Objetivo:**
Prevenir push direto em `main` e garantir qualidade do código.

**Critérios de Aceitação:**
- [ ] Branch protection configurada no GitHub
- [ ] Require PR before merging habilitado
- [ ] Require status checks (CI tests) habilitado
- [ ] Include administrators habilitado

**Etapas:**
1. Ir em Settings → Branches no GitHub
2. Add rule para `main`
3. Configurar proteções conforme `docs/BRANCH_PROTECTION.md`
4. Testar tentando push direto (deve falhar)

**Documentação:**
Ver `docs/BRANCH_PROTECTION.md` para instruções detalhadas

**Estimativa:** < 1 hora

---

### Issue 2: Adicionar badge de CI status no README

**Labels:** `documentation`, `task`, `priority: high`

**Descrição:**
Adicionar badge do GitHub Actions mostrando status do CI no README.

**Objetivo:**
Mostrar visualmente que o projeto tem testes passando.

**Critérios de Aceitação:**
- [ ] Badge de CI adicionado ao topo do README
- [ ] Badge mostra status correto (verde quando testes passam)
- [ ] Link do badge direciona para Actions

**Etapas:**
1. Pegar URL do badge em Actions → CI workflow → ⋯ → Create status badge
2. Adicionar ao README.md logo após o título
3. Testar que badge aparece e funciona

**Exemplo:**
```markdown
# Orlando 2026

![CI](https://github.com/brunopintobrum/kovoy_app/actions/workflows/ci.yml/badge.svg)
```

**Estimativa:** < 1 hora

---

### Issue 3: Deploy em produção

**Labels:** `enhancement`, `priority: high`

**Descrição:**
Fazer deploy público da aplicação para produção.

**Objetivo:**
Tornar o app acessível publicamente para uso real.

**Critérios de Aceitação:**
- [ ] Escolher plataforma de hospedagem (Render, Railway, Fly.io, VPS)
- [ ] Configurar variáveis de ambiente de produção
- [ ] Configurar banco de dados SQLite persistente
- [ ] Configurar domínio (opcional)
- [ ] Deploy realizado com sucesso
- [ ] App acessível via URL pública
- [ ] Monitoramento configurado

**Etapas:**
1. Escolher plataforma (Recomendado: Render ou Railway)
2. Criar `.env.production` com variáveis corretas
3. Configurar build/start scripts
4. Deploy inicial
5. Testar funcionalidades principais
6. Documentar processo no README

**Recursos Necessários:**
- Conta na plataforma de hospedagem
- Domínio (opcional, pode usar subdomínio da plataforma)
- SMTP para emails (Mailgun, SendGrid, etc)

**Estimativa:** 1 dia

---

## 🟠 MÉDIA PRIORIDADE

### Issue 4: Sistema de anexos e recibos

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Implementar upload e preview de anexos/recibos para despesas, voos, hospedagens e outros módulos.

**Objetivo:**
Permitir que usuários anexem comprovantes e documentos aos registros.

**Critérios de Aceitação:**
- [ ] Upload de arquivos (imagens, PDFs)
- [ ] Preview de imagens inline
- [ ] Preview de PDFs em modal
- [ ] Limite de tamanho por arquivo (ex: 5MB)
- [ ] Storage configurável (local ou S3)
- [ ] Múltiplos anexos por item
- [ ] Delete de anexos

**Etapas:**
1. Criar schema de tabela `attachments`
2. Implementar upload com Multer
3. Criar endpoint de upload
4. Adicionar UI de upload nos formulários
5. Implementar preview
6. Adicionar testes

**Recursos Necessários:**
- Storage (local filesystem ou AWS S3)
- Biblioteca de preview (para PDFs)

**Estimativa:** Vários dias

---

### Issue 5: Categorias avançadas e filtros no painel

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Implementar sistema de categorias customizáveis e filtros avançados no dashboard.

**Objetivo:**
Melhorar organização e visualização de despesas e itens.

**Critérios de Aceitação:**
- [ ] Categorias customizáveis por grupo
- [ ] Subcategorias
- [ ] Filtros por categoria, data, valor, participante
- [ ] Filtros combinados (AND/OR)
- [ ] Salvar filtros favoritos
- [ ] Exportar resultados filtrados

**Etapas:**
1. Criar schema de categorias customizadas
2. Implementar CRUD de categorias
3. Adicionar filtros na UI do dashboard
4. Implementar lógica de filtragem no backend
5. Adicionar persistência de filtros (localStorage)
6. Testes

**Estimativa:** Vários dias

---

### Issue 6: Multi-moeda e câmbio por data

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Suporte a múltiplas moedas com conversão automática baseada em taxa de câmbio histórica.

**Objetivo:**
Permitir viagens internacionais com despesas em diferentes moedas.

**Critérios de Aceitação:**
- [ ] Suporte a múltiplas moedas (USD, EUR, BRL, etc)
- [ ] Taxa de câmbio por data
- [ ] Conversão automática para moeda do grupo
- [ ] API de taxas (ex: exchangerate-api.com)
- [ ] Histórico de taxas armazenado
- [ ] Fallback para taxa manual
- [ ] Exibir valores originais + convertidos

**Etapas:**
1. Integrar API de taxas de câmbio
2. Criar schema para armazenar taxas históricas
3. Implementar lógica de conversão
4. Atualizar UI para mostrar valores convertidos
5. Adicionar configuração de moeda padrão do grupo
6. Testes

**Recursos Necessários:**
- API key de serviço de câmbio (ex: exchangerate-api.com - gratuito)

**Estimativa:** Vários dias

---

### Issue 7: Timeline do grupo e notificações

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Feed de atividades do grupo e sistema de notificações.

**Objetivo:**
Manter membros informados sobre mudanças e atividades no grupo.

**Critérios de Aceitação:**
- [ ] Timeline de atividades (quem fez o quê)
- [ ] Notificações in-app
- [ ] Notificações por email (opcional)
- [ ] Marcação de notificações como lidas
- [ ] Filtros de timeline (por tipo, por membro)
- [ ] Permissões configuráveis

**Etapas:**
1. Criar schema de timeline/audit log
2. Implementar tracking de ações
3. Criar endpoint de timeline
4. Implementar UI de timeline
5. Sistema de notificações
6. Email notifications (opcional)
7. Testes

**Estimativa:** Vários dias

---

### Issue 8: Importação e exportação (CSV/JSON)

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Importar e exportar dados de grupos, participantes e despesas.

**Objetivo:**
Facilitar backup, migração e análise de dados.

**Critérios de Aceitação:**
- [ ] Exportar despesas para CSV
- [ ] Exportar dados completos do grupo para JSON
- [ ] Importar despesas de CSV
- [ ] Validação de dados importados
- [ ] Preview antes de importar
- [ ] Tratamento de erros
- [ ] Documentação de formato

**Etapas:**
1. Implementar export para CSV (despesas)
2. Implementar export para JSON (grupo completo)
3. Implementar import de CSV
4. Validação e sanitização
5. UI de import/export
6. Testes
7. Documentar formato dos arquivos

**Recursos Necessários:**
- Biblioteca CSV (já tem csv-parse)

**Estimativa:** 1-4 horas (export), Vários dias (import com validação)

---

### Issue 9: Auditoria de alterações

**Labels:** `enhancement`, `priority: medium`

**Descrição:**
Sistema de auditoria para rastrear quem alterou o quê e quando.

**Objetivo:**
Transparência e rastreabilidade de mudanças no grupo.

**Critérios de Aceitação:**
- [ ] Log de todas as alterações (create, update, delete)
- [ ] Registro de quem fez a alteração
- [ ] Timestamp de alteração
- [ ] Valores antes/depois (diff)
- [ ] Filtros por usuário, data, tipo
- [ ] Retenção configurável
- [ ] Permissões de visualização

**Etapas:**
1. Criar schema de audit_log
2. Implementar middleware de auditoria
3. Capturar alterações em todas as operações
4. Criar endpoint de consulta de logs
5. UI de visualização de logs
6. Testes

**Estimativa:** Vários dias

---

## 🟢 BAIXA PRIORIDADE

### Issue 10: Ampliar cobertura de testes E2E

**Labels:** `task`, `priority: low`

**Descrição:**
Adicionar mais testes E2E para cobrir cenários não testados.

**Objetivo:**
Aumentar confiança no CI e reduzir bugs em produção.

**Critérios de Aceitação:**
- [ ] Testes E2E para módulo de hospedagens
- [ ] Testes E2E para módulo de transportes
- [ ] Testes E2E para módulo de tickets
- [ ] Testes E2E para OAuth Google
- [ ] Testes E2E para recovery de senha
- [ ] Testes E2E para perfil de usuário
- [ ] Cobertura > 80%

**Etapas:**
1. Identificar cenários não cobertos
2. Criar specs do Playwright
3. Implementar testes
4. Verificar que passam no CI
5. Documentar

**Estimativa:** Vários dias

---

### Issue 11: Testes de segurança

**Labels:** `task`, `priority: low`, `documentation`

**Descrição:**
Implementar testes de segurança automatizados.

**Objetivo:**
Garantir que não há vulnerabilidades comuns (OWASP Top 10).

**Critérios de Aceitação:**
- [ ] Testes de SQL injection
- [ ] Testes de XSS
- [ ] Testes de CSRF
- [ ] Testes de autenticação/autorização
- [ ] Scan de dependências vulneráveis
- [ ] Configurar Dependabot
- [ ] Documentar práticas de segurança

**Etapas:**
1. Adicionar testes de segurança
2. Configurar Dependabot no GitHub
3. Scan com npm audit no CI
4. Documentar práticas

**Estimativa:** 1-4 horas

---

### Issue 12: Adicionar linter ao CI

**Labels:** `task`, `priority: low`

**Descrição:**
Adicionar ESLint ao pipeline de CI para garantir qualidade de código.

**Objetivo:**
Manter código consistente e identificar problemas automaticamente.

**Critérios de Aceitação:**
- [ ] ESLint configurado
- [ ] Regras definidas (Airbnb ou Standard)
- [ ] Lint roda no CI
- [ ] CI falha se houver erros de lint
- [ ] Scripts de lint no package.json

**Etapas:**
1. Instalar ESLint e config
2. Criar `.eslintrc.js`
3. Adicionar script `npm run lint`
4. Adicionar step de lint no CI
5. Corrigir erros existentes
6. Documentar

**Estimativa:** 1-4 horas

---

### Issue 13: Observabilidade - Logs estruturados

**Labels:** `enhancement`, `priority: low`

**Descrição:**
Implementar sistema de logs estruturados e métricas.

**Objetivo:**
Facilitar debugging e monitoramento em produção.

**Critérios de Aceitação:**
- [ ] Logger estruturado (Winston ou Pino)
- [ ] Logs em formato JSON
- [ ] Níveis de log (debug, info, warn, error)
- [ ] Logs de requisições HTTP
- [ ] Logs de erros com stack trace
- [ ] Configuração por ambiente
- [ ] (Opcional) Integração com serviço (Datadog, Sentry)

**Etapas:**
1. Instalar Winston ou Pino
2. Configurar logger
3. Substituir console.log por logger
4. Adicionar logs em pontos críticos
5. Configurar níveis por ambiente
6. Documentar

**Estimativa:** 1-4 horas

---

### Issue 14: Observabilidade - Métricas

**Labels:** `enhancement`, `priority: low`

**Descrição:**
Adicionar métricas de performance e uso.

**Objetivo:**
Monitorar saúde da aplicação e identificar gargalos.

**Critérios de Aceitação:**
- [ ] Métricas de tempo de resposta
- [ ] Métricas de uso de memória
- [ ] Métricas de requisições/segundo
- [ ] Health check endpoint
- [ ] (Opcional) Dashboard de métricas

**Etapas:**
1. Adicionar biblioteca de métricas
2. Instrumentar código
3. Criar endpoint `/health`
4. Configurar coleta de métricas
5. (Opcional) Integrar com Prometheus/Grafana

**Estimativa:** 1-4 horas

---

### Issue 15: Criar CHANGELOG.md

**Labels:** `documentation`, `task`, `priority: low`

**Descrição:**
Criar e manter arquivo CHANGELOG.md seguindo Keep a Changelog.

**Objetivo:**
Documentar mudanças entre versões para usuários e desenvolvedores.

**Critérios de Aceitação:**
- [ ] Arquivo CHANGELOG.md criado
- [ ] Segue formato Keep a Changelog
- [ ] Versionamento semântico (SemVer)
- [ ] Categorias: Added, Changed, Deprecated, Removed, Fixed, Security
- [ ] Atualizado a cada release

**Etapas:**
1. Criar CHANGELOG.md com template
2. Adicionar histórico de versões passadas
3. Documentar processo de atualização
4. Integrar com release workflow

**Recursos:**
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

**Estimativa:** 1-4 horas

---

### Issue 16: Configurar Dependabot

**Labels:** `task`, `priority: low`

**Descrição:**
Configurar Dependabot para atualizar dependências automaticamente.

**Objetivo:**
Manter dependências atualizadas e seguras.

**Critérios de Aceitação:**
- [ ] Dependabot configurado no GitHub
- [ ] PRs automáticas para atualizações
- [ ] Configuração de schedule (semanal)
- [ ] Grouping de atualizações (patch versions)
- [ ] Auto-merge para patches (opcional)

**Etapas:**
1. Criar `.github/dependabot.yml`
2. Configurar npm ecosystem
3. Definir schedule
4. Testar que PRs são criadas
5. Documentar processo de review

**Exemplo de config:**
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

**Estimativa:** < 1 hora

---

## 📊 RESUMO

| Prioridade | Quantidade | Estimativa Total |
|------------|------------|------------------|
| Alta | 3 | ~2 dias |
| Média | 6 | ~3-4 semanas |
| Baixa | 7 | ~1 semana |
| **Total** | **16** | **~1-2 meses** |

---

## 🎯 ORDEM RECOMENDADA DE EXECUÇÃO

1. **Issue 1** - Proteção de branch (crítico)
2. **Issue 2** - Badge de CI (rápido)
3. **Issue 16** - Dependabot (rápido)
4. **Issue 12** - Linter no CI (qualidade)
5. **Issue 3** - Deploy em produção (marco importante)
6. **Issue 15** - CHANGELOG (organização)
7. **Issue 8** - Import/Export (útil para backup)
8. **Issue 4** - Anexos (feature visível)
9. **Issues 5-7** - Features avançadas
10. **Issues 10-14** - Melhorias técnicas

---

## 📝 COMO USAR ESTE ARQUIVO

1. Copie cada issue para o GitHub:
   - Vá em: https://github.com/brunopintobrum/kovoy_app/issues/new/choose
   - Escolha template "Task"
   - Cole o conteúdo
   - Adicione labels
   - Submit

2. Adicione ao Project Board:
   - Adicione a issue ao projeto
   - Coluna: "📋 Backlog"

3. Priorize conforme sua necessidade

---

**Criado em:** 2026-02-07
**Versão:** 1.0
