# "Ask Market Partner" AI widget — setup guide

This adds a floating "Ask us" chat button to every page of the site. Visitors
can ask questions about Market Partner and get answers from Claude, grounded
in a description of the business (services, positioning, contact details) —
not the open internet, and not your live customer data.

It's already wired into all 9 pages and is **safe to have live right now** —
until you complete the steps below, the widget code checks its own config,
sees it isn't set up yet, and does nothing. No button appears, nothing breaks.

## What you're setting up

Two pieces:

1. **The widget** (`assets/ask-widget.js`) — already in the repo, already
   linked from every page. This is the button/chat window a visitor sees.
2. **A small backend** (`cloudflare-worker/worker.js`) — this is what
   actually holds your Anthropic API key and talks to Claude. It **cannot**
   live on GitHub Pages (that's static hosting only, no server-side code
   allowed), so it needs a separate, tiny, free service. We're using
   [Cloudflare Workers](https://workers.cloudflare.com/), which has a
   generous free tier and takes about 10 minutes to set up the first time.

## Step 1 — Get an Anthropic API key

This is separate from a claude.ai subscription — it's pay-as-you-go billing
for API usage (a chat widget like this typically costs a few dollars a month
even with decent traffic, since it uses the cheap/fast Haiku model).

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up
   or log in.
2. Add a small amount of billing credit (Settings → Billing).
3. Create an API key (Settings → API Keys → Create Key). Copy it somewhere
   safe — you won't be able to see it again.

## Step 2 — Deploy the Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up for
   a free account if you don't have one.
2. In the left sidebar, go to **Workers & Pages** → **Create** → **Create
   Worker**. Give it a name (e.g. `marketpartner-ask-widget`) and deploy the
   default "Hello World" template — you'll replace the code next.
3. Click **Edit code**. Delete everything in the editor and paste in the
   full contents of `cloudflare-worker/worker.js` from this repo. Click
   **Deploy**.
4. Go to the Worker's **Settings → Variables and Secrets** and add:
   - `ANTHROPIC_API_KEY` — the key from Step 1. Mark it as **Secret** (not
     plain text).
   - `ALLOWED_ORIGIN` — `https://market-partner-sites.github.io` (no
     trailing slash). This is what stops random other sites from using your
     Worker and running up your bill. **Update this again if the repo ever
     moves to a different GitHub org/user, or once the site moves to a
     custom domain (e.g. `https://marketpartner.com`) — the value has to
     match exactly wherever the site is actually being viewed from, or the
     widget fails with a CORS error.**
   - `LEAD_WEBHOOK_URL` *(optional)* — see Step 4 below if you want the
     "leave your email" feature to actually notify you. You can skip this
     for now and add it later; the widget works fine without it.
5. Copy the Worker's URL — it's shown at the top of the Worker's page,
   something like `https://marketpartner-ask-widget.<your-subdomain>.workers.dev`.

## Step 3 — Point the widget at your Worker

Open `assets/ask-widget.js` and find these two lines near the top:

```js
var ASK_WORKER_URL = "REPLACE-WITH-YOUR-WORKER-URL";
...
var DEMO_MODE = true;
```

Replace them with the Worker URL you copied in Step 2, and switch off demo
mode:

```js
var ASK_WORKER_URL = "https://marketpartner-ask-widget.yoursubdomain.workers.dev";
...
var DEMO_MODE = false;
```

Until `DEMO_MODE` is set to `false`, the widget shows a few canned demo
replies instead of calling the real backend — that's deliberate, so you can
see the look and feel live on the site with zero setup and no cost.

Save, commit, and push as usual (or send this one file back to me and I'll
ship it the normal way). As soon as this is live, the widget calls the real
AI instead of showing demo replies.

## Step 4 — (Optional) Get notified when someone leaves their email

The widget can offer visitors an inline "leave your email and we'll follow
up" prompt when it can't fully answer, or when they seem ready to talk to a
person. For this to actually reach you, the Worker needs somewhere to send
it — set `LEAD_WEBHOOK_URL` to a form-backend endpoint. Two free, no-code
options that just email you when they receive a submission:

- [Web3Forms](https://web3forms.com) — free, no signup beyond an access key.
- [Formspree](https://formspree.io) — free tier, requires an account.

Either one gives you a URL to paste into the `LEAD_WEBHOOK_URL` secret in
Step 2.4 above. Without this set, visitors can still chat and ask questions
— they just won't see the "leave your email" option.

## Rolling it back

You said you might not like this — good news, it's fully reversible and
low-risk either way:

- **Turn off the widget on the site**: remove the
  `<script src="assets/ask-widget.js" defer></script>` line from any page
  (or all of them), or just `git revert` the commit that added it. The
  button disappears instantly, nothing else on the site is touched.
- **Turn off the backend**: pause or delete the Worker in the Cloudflare
  dashboard. This stops it from working (and stops any further API costs)
  even if the script tag is still on the page — visitors would just see a
  graceful "something went wrong, email us" message instead of a broken
  widget.
- Either action is independent of the other and takes under a minute.

## What it costs

- **Cloudflare Workers**: free tier covers 100,000 requests/day — a
  marketing site's chat widget won't come close.
- **Anthropic API**: pay-as-you-go, billed by usage. The widget uses Claude
  Haiku (the fastest/cheapest current model) with a capped reply length, so
  typical cost is small — but it's still real usage-based spend with no
  fixed cap unless you set a billing limit in the Anthropic console
  (recommended: set a monthly spend limit there as a safety net).
- **Lead webhook** (if used): Web3Forms/Formspree free tiers cover a normal
  volume of site enquiries.

## What it knows (and doesn't)

The assistant's knowledge is a written description of Market Partner's
services, positioning, and contact details — baked into the Worker's system
prompt, not pulled live from the site or any database. It doesn't see your
email, CRM, or any visitor's personal data. If your services or positioning
change significantly, the system prompt in `cloudflare-worker/worker.js`
should be updated to match — ask me to update it any time the site's copy
changes meaningfully.
