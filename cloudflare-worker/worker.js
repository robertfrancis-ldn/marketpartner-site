// Market Partner "Ask us" AI widget — backend
//
// Deploy this as a Cloudflare Worker (free tier is plenty for a site widget).
// See ASK_WIDGET_SETUP.md in the repo root for the full step-by-step.
//
// Required secrets (set via `wrangler secret put <NAME>` or the dashboard):
//   ANTHROPIC_API_KEY  - your Anthropic API key, from console.anthropic.com
//   ALLOWED_ORIGIN      - e.g. https://robertfrancis-ldn.github.io (NO trailing slash,
//                          NO path — just the scheme + host). Update this if/when the
//                          site moves to a custom domain.
// Optional secret:
//   LEAD_WEBHOOK_URL    - a form-backend URL (e.g. a free Formspree or Web3Forms
//                          endpoint) that emails you when a visitor leaves their
//                          email address via the widget. Leave unset to disable
//                          lead capture — the widget still answers questions fine
//                          without it.

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;
const MAX_HISTORY_MESSAGES = 12; // caps how much conversation is replayed per request
const MAX_MESSAGE_CHARS = 1000;

const SYSTEM_PROMPT = `You are "Ask Market Partner" — a helpful AI assistant embedded on the Market Partner website (marketpartner.com), a London-based marketing & event technology company. You answer visitor questions about Market Partner only.

ABOUT MARKET PARTNER
- The core pitch: category-leading technology, combined with hands-on project management and support that off-the-shelf SaaS platforms don't offer — plus bespoke consultancy for problems generic software can't touch. Not just a tool vendor: a technology partner and, where needed, a consultancy.
- Every site/platform runs on an AI-editable template. This gives speed without losing control: a non-technical "event manager" can safely update content (agendas, speakers, forms) through a normal CMS with no access to the underlying template, while a technical "site owner" can use AI directly to edit the template itself. The point is harnessing AI while keeping control of what matters — customer data.
- Full visibility on results: every visitor action is tracked end to end, and leads/conversions are linked back to the content and campaigns that produced them, so clients can show real ROI, not just activity.
- Studio: The Boathouse Design Studio, 27 Ferry Road, Teddington, Richmond, London TW11 9NN.
- Contact: hello@marketpartner.com.

SERVICES (8 total)
Event technology:
1. Event companion app — the event in attendees' pockets: agenda, speakers, networking, live polls/Q&A, push notifications.
2. Registration sites — branded, custom registration built fast, not a generic form builder.
3. Virtual event production — a branded events platform; the physical production (crew, cameras, studio) is delivered through production partner SE1 Studios, run from their London base, project-managed end to end by Market Partner. This is about production values through project management, not equipment ownership.
4. Attendance management — badging and check-in, on-demand or pre-printed, real-time tracking.
5. Touchscreen rental & software development — hardware plus the bespoke software that runs on it, for engaging on-site experiences.

Beyond the event:
6. Content & community hub — an always-on content and community platform, not tied to any single event.
7. Survey forms — feedback and data collection tools.

Cross-cutting:
8. Custom solutions & consultancy — bespoke builds for briefs that don't fit an off-the-shelf answer; part technology partner, part consultancy.

HOW TO ANSWER
- Be concise, warm, and specific — aim for under ~120 words per reply, plain text, no markdown headers or bullet lists (short sentences and the occasional dash are fine).
- Never invent facts: no made-up pricing, client names, statistics, or case-study details. Market Partner doesn't publish pricing — if asked, say pricing depends on scope and offer to connect them with the team.
- If a question is unrelated to Market Partner (general trivia, coding help, etc.), politely decline and steer back: say you're just here to help with questions about Market Partner.
- You are an AI assistant, not a human team member — if asked, say so plainly. Do not name a specific underlying AI model or vendor.
- If you can't confidently answer, or the visitor is asking about pricing, a specific project/quote, or otherwise seems ready to talk to a real person, end your reply — on its own new line, after your normal reply text — with exactly this token and nothing else on that line:
===OFFER_FOLLOWUP===
Never mention or explain this token to the visitor; it is stripped before they see your reply.`;

function corsHeaders(origin, allowedOrigin) {
  const allow = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return new Response(JSON.stringify({ error: "origin not allowed" }), {
        status: 403,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/ask") {
      return handleAsk(request, env, headers);
    }
    if (request.method === "POST" && url.pathname === "/lead") {
      return handleLead(request, env, headers);
    }
    return new Response("Not found", { status: 404, headers });
  },
};

async function handleAsk(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400, headers);
  }

  const message = String(body.message || "").slice(0, MAX_MESSAGE_CHARS).trim();
  const historyIn = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

  if (!message) {
    return jsonResponse({ error: "empty message" }, 400, headers);
  }

  const messages = historyIn
    .map((h) => ({
      role: h && h.role === "assistant" ? "assistant" : "user",
      content: String((h && h.content) || "").slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content);
  messages.push({ role: "user", content: message });

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
  } catch (e) {
    return jsonResponse({ error: "upstream request failed" }, 502, headers);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.log("Anthropic API error", anthropicRes.status, errText);
    return jsonResponse({ error: "upstream error" }, 502, headers);
  }

  const data = await anthropicRes.json();
  const text = (data.content || [])
    .map((block) => block.text || "")
    .join("")
    .trim();

  const marker = "===OFFER_FOLLOWUP===";
  let reply = text;
  let offerFollowup = false;
  if (text.includes(marker)) {
    offerFollowup = true;
    reply = text.split(marker)[0].trim();
  }

  return jsonResponse({ reply, offerFollowup }, 200, headers);
}

async function handleLead(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400, headers);
  }

  const email = String(body.email || "").trim().slice(0, 200);
  const question = String(body.question || "").slice(0, MAX_MESSAGE_CHARS);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return jsonResponse({ error: "invalid email" }, 400, headers);
  }

  if (env.LEAD_WEBHOOK_URL) {
    try {
      const forwardRes = await fetch(env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "Ask Market Partner widget",
          email,
          question,
          submittedAt: new Date().toISOString(),
        }),
      });
      if (!forwardRes.ok) throw new Error("webhook responded " + forwardRes.status);
    } catch (e) {
      console.log("Lead webhook failed", e);
      return jsonResponse({ error: "could not forward lead" }, 502, headers);
    }
  }

  return jsonResponse({ ok: true }, 200, headers);
}

function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}
