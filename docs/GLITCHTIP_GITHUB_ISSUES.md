# GlitchTip -> GitHub Issues (Automático)

Objetivo: tudo que aparecer no GlitchTip (via alert/webhook) vira uma issue no GitHub automaticamente, com dedupe para evitar spam.

## Arquitetura

- GlitchTip Alert (Webhook) -> Cloudflare Worker -> GitHub Issues API
- Dedupe: Cloudflare KV (`ISSUE_MAP`) mapeia "glitchtip issue/event" -> "github issue number".

## Deploy (Cloudflare Worker)

1. Entre em `cloudflare/glitchtip-github-issues`.
2. Instale deps:
   - `npm install`
3. Crie um KV namespace (Cloudflare dashboard) e coloque os IDs em `cloudflare/glitchtip-github-issues/wrangler.toml`.
4. Configure variáveis/segredos no Cloudflare:
   - `GITHUB_OWNER` (ex: `brunopintobrum`)
   - `GITHUB_REPO` (ex: `kovoy_app`)
   - `GITHUB_TOKEN` (secret)
   - `WEBHOOK_TOKEN` (secret)
   - Opcional: `GITHUB_LABELS`, `GITHUB_ASSIGNEE`, `ON_REPEAT=comment|ignore`
5. Deploy:
   - `npm run deploy`

Endpoint:
- `POST /webhook/glitchtip?token=WEBHOOK_TOKEN`
- `GET /healthz`

## Configurar o GlitchTip (Alert Webhook)

No projeto (backend e frontend):

1. O GlitchTip expõe uma API de "Project Alerts" em `POST /api/0/projects/{org}/{project}/alerts/`.
2. Este repo já tem um script idempotente que cria/atualiza os alerts para `kovoy-backend` e `kovoy-frontend`:
   - `pwsh scripts/setup-glitchtip-github-issues-alerts.ps1`
3. O worker recebe o webhook em:
   - `POST /webhook/glitchtip?token=<WEBHOOK_TOKEN>`

## Observações

- O worker aceita payload JSON padrão Sentry-like e também payload estilo Slack (attachments), tentando extrair `title` e `url`.
- Para evitar spam, o default é criar issue só quando ainda não existe mapeamento no KV (repetições são ignoradas).
