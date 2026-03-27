# Política de Segurança

## Versões suportadas

Este projeto está em desenvolvimento ativo. Apenas a versão mais recente na branch `main` recebe correções de segurança.

## Reportando uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança neste projeto, **não abra uma issue pública**.

Entre em contato diretamente com o mantenedor via e-mail ou pela funcionalidade de [Security Advisories do GitHub](https://github.com/brunopintobrum/kovoy_app/security/advisories/new).

Inclua no relato:
- Descrição clara da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (opcional)

## Proteções implementadas

| Camada | Medida |
|---|---|
| Autenticação | JWT com cookie HttpOnly + SameSite=Lax |
| CSRF | Token duplo (cookie + header `x-csrf-token`) |
| XSS | Helmet.js com Content-Security-Policy |
| SQL Injection | Prepared statements (better-sqlite3) |
| Rate limiting | `sensitiveLimiter` (10 req/15min) em login e registro; `dataLimiter` (100 req/min) em endpoints autenticados |
| Autorização | Middleware `requireGroupMember` + `requireGroupRole` em todos os endpoints de grupo |
| Dependências | `npm audit` executado automaticamente no CI a cada push |

## Testes de segurança automatizados

O arquivo `tests/security.test.js` cobre:

- SQL injection nos campos de input (email, nome do grupo, descrição de despesa)
- XSS stored (script tags em campos de texto)
- CSRF (requisições sem token retornam 403)
- Autorização (viewer não pode editar; non-member retorna 403; não autenticado retorna 401)
- Configuração de rate limiting verificada em suite dedicada
