/*
 * Market Partner "Ask us" AI widget — front end.
 * Included on every page via <script src="assets/ask-widget.js" defer></script>.
 *
 * SETUP: this widget does nothing until you deploy the matching Cloudflare
 * Worker backend (see /cloudflare-worker and ASK_WIDGET_SETUP.md in the repo
 * root) and paste its URL into ASK_WORKER_URL below. Until then it silently
 * no-ops — safe to ship as-is.
 *
 * ROLLBACK: delete the <script src="assets/ask-widget.js" defer></script>
 * line from a page (or all pages) to remove the widget instantly. The
 * backend can also be paused/deleted independently in the Cloudflare
 * dashboard without touching the site itself.
 */
(function () {
  "use strict";

  // ---- CONFIG: set this to your deployed Worker URL, e.g. ----
  // "https://marketpartner-ask-widget.yoursubdomain.workers.dev"
  var ASK_WORKER_URL = "REPLACE-WITH-YOUR-WORKER-URL";
  // --------------------------------------------------------------

  // ---- TEMPORARY PREVIEW MODE ----
  // While true, the widget shows canned demo replies instead of calling a
  // real backend — no Cloudflare Worker needed yet. This lets you see and
  // click through the actual UI on the live site before setting anything
  // up. Set to false (and set ASK_WORKER_URL above) once the real backend
  // is deployed — see ASK_WIDGET_SETUP.md.
  var DEMO_MODE = true;
  // ---------------------------------

  if (!DEMO_MODE && (!ASK_WORKER_URL || ASK_WORKER_URL.indexOf("REPLACE-WITH") !== -1)) {
    return; // not configured yet — don't show a non-functional widget
  }

  var MAX_MESSAGES_PER_SESSION = 20;
  var messageCount = 0;
  var history = [];

  var style = document.createElement("style");
  style.textContent =
    ".mp-ask-btn{position:fixed;right:22px;bottom:22px;z-index:9999;width:56px;height:56px;border-radius:50%;background:var(--brand,#0000ff);color:#fff;border:none;box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}" +
    ".mp-ask-btn:hover{transform:scale(1.06);}" +
    ".mp-ask-btn svg{width:24px;height:24px;}" +
    ".mp-ask-panel{position:fixed;right:22px;bottom:90px;z-index:9999;width:360px;max-width:calc(100vw - 44px);height:480px;max-height:calc(100vh - 140px);background:var(--bg-raised,#fff);border:1px solid var(--border,#c6c9d3);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font-family:'Hanken Grotesk',system-ui,sans-serif;}" +
    ".mp-ask-panel.open{display:flex;}" +
    ".mp-ask-head{background:var(--brand,#0000ff);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex:0 0 auto;}" +
    ".mp-ask-head strong{font-size:15px;display:block;}" +
    ".mp-ask-head span{display:block;font-size:11px;opacity:.8;margin-top:2px;}" +
    ".mp-ask-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:4px;}" +
    ".mp-ask-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}" +
    ".mp-ask-msg{font-size:13.5px;line-height:1.45;max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;}" +
    ".mp-ask-msg.user{align-self:flex-end;background:var(--brand,#0000ff);color:#fff;border-bottom-right-radius:3px;}" +
    ".mp-ask-msg.bot{align-self:flex-start;background:var(--bg-alt,#f4f4f8);color:var(--ink,#12121a);border-bottom-left-radius:3px;}" +
    ".mp-ask-msg.system{align-self:center;font-size:11.5px;color:var(--ink-soft,#666);text-align:center;max-width:100%;background:none;padding:2px 8px;}" +
    ".mp-ask-lead{align-self:flex-start;background:var(--bg-alt,#f4f4f8);border:1px solid var(--border,#c6c9d3);border-radius:12px;padding:10px 12px;font-size:12.5px;max-width:92%;color:var(--ink,#12121a);}" +
    ".mp-ask-lead input{width:100%;margin-top:6px;padding:7px 9px;font-size:13px;border-radius:8px;border:1px solid var(--border,#c6c9d3);box-sizing:border-box;font-family:inherit;}" +
    ".mp-ask-lead button{margin-top:8px;background:var(--accent,#ff2fb0);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12.5px;cursor:pointer;}" +
    ".mp-ask-lead button:disabled{opacity:.6;cursor:default;}" +
    ".mp-ask-foot{border-top:1px solid var(--border,#c6c9d3);padding:10px;display:flex;gap:8px;flex:0 0 auto;}" +
    ".mp-ask-foot input{flex:1;border:1px solid var(--border,#c6c9d3);border-radius:10px;padding:9px 11px;font-size:13.5px;font-family:inherit;box-sizing:border-box;background:var(--bg-raised,#fff);color:var(--ink,#12121a);}" +
    ".mp-ask-foot button{background:var(--brand,#0000ff);color:#fff;border:none;border-radius:10px;padding:0 14px;font-size:13px;cursor:pointer;}" +
    ".mp-ask-foot button:disabled{opacity:.5;cursor:default;}" +
    ".mp-ask-disclosure{font-size:10.5px;color:var(--ink-soft,#888);text-align:center;padding:0 12px 8px;flex:0 0 auto;}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "mp-ask-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Ask Market Partner a question");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4.5h16a1 1 0 011 1V16a1 1 0 01-1 1H9l-4.5 4V17H4a1 1 0 01-1-1V5.5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  var panel = document.createElement("div");
  panel.className = "mp-ask-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask Market Partner");
  panel.innerHTML =
    '<div class="mp-ask-head">' +
    "<div><strong>Ask Market Partner</strong><span>" +
    (DEMO_MODE ? "Preview mode &middot; canned demo replies" : "AI assistant &middot; usually instant") +
    "</span></div>" +
    '<button type="button" class="mp-ask-close" aria-label="Close">&times;</button>' +
    "</div>" +
    '<div class="mp-ask-body" id="mpAskBody">' +
    '<div class="mp-ask-msg bot">Hi &mdash; ask me anything about Market Partner’s platform, services or how we work. For anything urgent, email hello@marketpartner.com.</div>' +
    "</div>" +
    '<div class="mp-ask-disclosure">' +
    (DEMO_MODE
      ? "Preview mode &mdash; these are canned demo replies, not a live AI yet."
      : "AI assistant &mdash; answers may be imperfect.") +
    "</div>" +
    '<div class="mp-ask-foot">' +
    '<input type="text" id="mpAskInput" placeholder="Type a question&hellip;" maxlength="500" />' +
    '<button type="button" id="mpAskSend">Send</button>' +
    "</div>";

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var bodyEl = panel.querySelector("#mpAskBody");
  var input = panel.querySelector("#mpAskInput");
  var sendBtn = panel.querySelector("#mpAskSend");
  var closeBtn = panel.querySelector(".mp-ask-close");

  btn.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  });
  closeBtn.addEventListener("click", function () {
    panel.classList.remove("open");
  });

  function addMessage(text, cls) {
    var div = document.createElement("div");
    div.className = "mp-ask-msg " + cls;
    div.textContent = text;
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  function addLeadForm(promptText) {
    var wrap = document.createElement("div");
    wrap.className = "mp-ask-lead";
    wrap.innerHTML =
      "<div>" +
      promptText +
      '</div><input type="email" placeholder="you@company.com" /><button type="button">Send my details</button>';
    var emailInput = wrap.querySelector("input");
    var submitBtn = wrap.querySelector("button");
    submitBtn.addEventListener("click", function () {
      var email = emailInput.value.trim();
      if (!email || email.indexOf("@") === -1 || email.indexOf(".") === -1) {
        emailInput.style.borderColor = "var(--accent,#ff2fb0)";
        emailInput.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      var lastQuestion = "";
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].role === "user") {
          lastQuestion = history[i].content;
          break;
        }
      }
      var leadRequest = DEMO_MODE
        ? fakeLeadSubmit()
        : fetch(ASK_WORKER_URL + "/lead", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: email, question: lastQuestion }),
          }).then(function (r) {
            if (!r.ok) throw new Error("failed");
          });

      leadRequest
        .then(function () {
          wrap.innerHTML =
            "<div>" +
            (DEMO_MODE ? "(Demo) " : "") +
            "Thanks &mdash; we’ll be in touch at " +
            escapeHtml(email) +
            ".</div>";
        })
        .catch(function () {
          wrap.innerHTML =
            "<div>Something went wrong &mdash; email us directly at hello@marketpartner.com instead.</div>";
        });
    });
    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Demo-mode canned responses (no network calls) ----
  function demoReply(text) {
    var t = text.toLowerCase();
    if (t.indexOf("price") !== -1 || t.indexOf("cost") !== -1 || t.indexOf("quote") !== -1) {
      return {
        reply:
          "We don't publish set pricing since projects vary a lot in scope — it depends on which services you need and how bespoke the build is.",
        offerFollowup: true,
      };
    }
    if (t.indexOf("service") !== -1 || t.indexOf("do you do") !== -1 || t.indexOf("offer") !== -1) {
      return {
        reply:
          "We cover event technology — registration sites, event apps, virtual event production, attendance management, touchscreen rental — plus content & community hubs, survey forms, and bespoke consultancy for anything off-the-shelf software can't handle.",
        offerFollowup: false,
      };
    }
    if (t.indexOf("ai") !== -1 || t.indexOf("template") !== -1) {
      return {
        reply:
          "Every site runs on an AI-editable template — your team can safely update content through a normal CMS, while a technical site owner can use AI directly to edit the template itself. You stay in control of what matters, like customer data.",
        offerFollowup: false,
      };
    }
    if (t.indexOf("contact") !== -1 || t.indexOf("email") !== -1 || t.indexOf("talk") !== -1) {
      return {
        reply: "You can reach the team any time at hello@marketpartner.com, or I can take your details and we'll follow up.",
        offerFollowup: true,
      };
    }
    return {
      reply:
        "Good question — in the real version I'd answer that using everything we know about Market Partner's platform and services. Try asking about pricing, our services, or the AI-editable template to see a couple of other demo replies.",
      offerFollowup: false,
    };
  }

  function fakeAsk(text) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(demoReply(text));
      }, 500 + Math.random() * 400);
    });
  }

  function fakeLeadSubmit() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 500);
    });
  }

  function send() {
    var text = input.value.trim();
    if (!text) return;
    if (messageCount >= MAX_MESSAGES_PER_SESSION) {
      addMessage(
        "You’ve reached the limit for this session — email hello@marketpartner.com and we’ll pick up from here.",
        "system"
      );
      return;
    }
    messageCount++;
    addMessage(text, "user");
    history.push({ role: "user", content: text });
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    var typing = addMessage("Thinking…", "bot");

    var askRequest = DEMO_MODE
      ? fakeAsk(text)
      : fetch(ASK_WORKER_URL + "/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
        }).then(function (r) {
          if (!r.ok) throw new Error("bad status");
          return r.json();
        });

    askRequest
      .then(function (data) {
        typing.remove();
        var reply = data && data.reply ? data.reply : "Sorry, I didn’t catch that — could you rephrase?";
        addMessage(reply, "bot");
        history.push({ role: "assistant", content: reply });
        if (data && data.offerFollowup) {
          addLeadForm("Want us to follow up directly? Leave your email and we will.");
        }
      })
      .catch(function () {
        typing.remove();
        addMessage(
          "Something went wrong on our end — please email hello@marketpartner.com and we’ll help directly.",
          "bot"
        );
      })
      .finally(function () {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      });
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });
})();
