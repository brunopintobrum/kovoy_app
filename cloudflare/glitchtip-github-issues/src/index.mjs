const textEncoder = new TextEncoder();

const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
};

const toLower = (value) => (typeof value === "string" ? value.toLowerCase() : "");

const normalizeCsv = (value) =>
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const pickFirstString = (...values) => values.find((value) => typeof value === "string" && value.trim());

const safeJsonParse = async (request) => {
  const contentType = toLower(request.headers.get("content-type"));
  if (contentType.includes("application/json")) {
    return await request.json();
  }
  // Some webhook integrations send text/plain JSON.
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const shortSha256 = async (input) => {
  const data = textEncoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const assertAuthorized = async (request, env) => {
  const expected = env.WEBHOOK_TOKEN;
  if (!expected) return { ok: true };

  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim();
  const actual = headerToken || queryToken;

  if (!actual || actual !== expected) {
    return { ok: false, response: json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
};

const extractGlitchTipIssue = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  // Sentry-like issue alert webhook
  const issue = payload?.data?.issue || payload?.issue;
  const project = payload?.data?.project || payload?.project;
  const event = payload?.data?.event || payload?.event;

  // Slack-like webhook payload sometimes uses attachments[0]
  const attachment = Array.isArray(payload.attachments) ? payload.attachments[0] : null;

  const title =
    pickFirstString(issue?.title, payload?.title, attachment?.title, attachment?.fallback, attachment?.text) ||
    "GlitchTip error";

  const url =
    pickFirstString(issue?.permalink, issue?.url, attachment?.title_link, attachment?.from_url, payload?.url) || null;

  const shortId = pickFirstString(issue?.shortId, issue?.short_id, payload?.shortId, payload?.short_id) || null;

  const issueId = pickFirstString(
    issue?.id && String(issue.id),
    issue?.issue_id && String(issue.issue_id),
    payload?.issueId && String(payload.issueId),
    payload?.issue_id && String(payload.issue_id)
  );

  const eventId = pickFirstString(event?.event_id, event?.id, payload?.event_id, payload?.eventId) || null;

  const projectSlug =
    pickFirstString(project?.slug, payload?.projectSlug, payload?.project_slug, payload?.project) || null;

  const level = pickFirstString(event?.level, issue?.level, payload?.level, attachment?.color) || null;
  const release = pickFirstString(event?.release, payload?.release) || null;

  return {
    title,
    url,
    shortId,
    issueId,
    eventId,
    projectSlug,
    level,
    release,
    raw: payload,
  };
};

const buildFingerprint = async (glitch) => {
  // Prefer stable identifiers if present; otherwise hash the title + project.
  const stable = pickFirstString(glitch.issueId, glitch.url, glitch.shortId, glitch.eventId);
  if (stable) return `glitchtip:${stable}`;
  const fallback = `${glitch.projectSlug || "unknown"}:${glitch.title}`;
  return `glitchtip:sha:${await shortSha256(fallback)}`;
};

const githubRequest = async (env, method, path, body) => {
  const url = `https://api.github.com${path}`;
  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "user-agent": "glitchtip-github-issues-worker",
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let jsonBody = null;
  try {
    jsonBody = text ? JSON.parse(text) : null;
  } catch {
    jsonBody = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: jsonBody || { raw: text },
    };
  }

  return { ok: true, status: response.status, body: jsonBody };
};

const createGithubIssue = async (env, glitch) => {
  const labels = normalizeCsv(env.GITHUB_LABELS);
  const assignee = (env.GITHUB_ASSIGNEE || "").trim();
  const prefix = (env.ISSUE_TITLE_PREFIX || "[GlitchTip]").trim();

  const titleParts = [prefix];
  if (glitch.projectSlug) titleParts.push(`[${glitch.projectSlug}]`);
  if (glitch.shortId) titleParts.push(glitch.shortId);
  titleParts.push(glitch.title);
  const title = titleParts.filter(Boolean).join(" ");

  const lines = [];
  if (glitch.url) lines.push(`GlitchTip: ${glitch.url}`);
  if (glitch.issueId) lines.push(`GlitchTip issue id: ${glitch.issueId}`);
  if (glitch.eventId) lines.push(`Event id: ${glitch.eventId}`);
  if (glitch.level) lines.push(`Level: ${glitch.level}`);
  if (glitch.release) lines.push(`Release: ${glitch.release}`);
  lines.push("");
  lines.push("Payload (truncated):");
  const raw = JSON.stringify(glitch.raw);
  const truncated = raw.length > 8000 ? `${raw.slice(0, 8000)}...` : raw;
  lines.push("```json");
  lines.push(truncated);
  lines.push("```");

  const body = {
    title,
    body: lines.join("\n"),
  };
  if (labels.length) body.labels = labels;
  if (assignee) body.assignees = [assignee];

  return await githubRequest(env, "POST", `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, body);
};

const maybeCommentOnRepeat = async (env, issueNumber, glitch) => {
  const mode = (env.ON_REPEAT || "ignore").trim().toLowerCase();
  if (mode !== "comment") return { ok: true, skipped: true };

  const lines = [];
  lines.push("New GlitchTip occurrence received.");
  if (glitch.url) lines.push(`GlitchTip: ${glitch.url}`);
  if (glitch.eventId) lines.push(`Event id: ${glitch.eventId}`);
  const body = { body: lines.join("\n") };

  return await githubRequest(
    env,
    "POST",
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}/comments`,
    body
  );
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook/glitchtip") {
      return json({ error: "Not found" }, { status: 404 });
    }

    const auth = await assertAuthorized(request, env);
    if (!auth.ok) return auth.response;

    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
      return json({ error: "Missing GitHub configuration" }, { status: 500 });
    }

    const payload = await safeJsonParse(request);
    if (!payload) return json({ error: "Invalid JSON payload" }, { status: 400 });

    const glitch = extractGlitchTipIssue(payload);
    if (!glitch) return json({ error: "Unsupported payload" }, { status: 400 });

    const fingerprint = await buildFingerprint(glitch);
    const kvKey = `issue-map:${fingerprint}`;
    const hasKv = Boolean(env.ISSUE_MAP && typeof env.ISSUE_MAP.get === "function");

    if (hasKv) {
      const existing = await env.ISSUE_MAP.get(kvKey, { type: "json" });
      if (existing?.github_issue_number) {
        const commentResult = await maybeCommentOnRepeat(env, existing.github_issue_number, glitch);
        return json({
          ok: true,
          deduped: true,
          fingerprint,
          github_issue_number: existing.github_issue_number,
          on_repeat: env.ON_REPEAT || "ignore",
          comment: commentResult.ok ? "ok" : commentResult,
        });
      }
    }

    const createMode = (env.CREATE_ON || "new_or_unmapped").trim().toLowerCase();
    if (createMode !== "new_or_unmapped") {
      return json({ ok: true, skipped: true, fingerprint, reason: "CREATE_ON disabled" });
    }

    const createResult = await createGithubIssue(env, glitch);
    if (!createResult.ok) {
      return json({ error: "Failed to create GitHub issue", details: createResult }, { status: 502 });
    }

    const githubIssueNumber = createResult.body?.number;
    if (hasKv && githubIssueNumber) {
      await env.ISSUE_MAP.put(
        kvKey,
        JSON.stringify({
          github_issue_number: githubIssueNumber,
          glitchtip_url: glitch.url || null,
          created_at: new Date().toISOString(),
        })
      );
    }

    return json({
      ok: true,
      deduped: false,
      fingerprint,
      github_issue_number: githubIssueNumber,
      github_url: createResult.body?.html_url || null,
    });
  },
};

