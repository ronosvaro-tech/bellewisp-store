// Bellewisp help chat — messages are delivered by email via FormSubmit (no backend needed).
(function () {
  const ENDPOINT = "https://formsubmit.co/ajax/ronosvaro@gmail.com";

  const QUICK = [
    "I can't complete checkout",
    "Which style is right for me?",
    "Shipping / order question",
  ];

  const root = document.createElement("div");
  root.className = "oxc";
  root.innerHTML = `
    <button class="oxc-btn" type="button" aria-label="Open help chat" aria-expanded="false">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.4 1.1 4.6 3 6.2L4 22l4.6-2.1c1.1.3 2.2.5 3.4.5 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg>
      <span class="oxc-btn-label">Need help?</span>
    </button>
    <div class="oxc-panel" role="dialog" aria-label="Help chat" hidden>
      <div class="oxc-head">
        <div><b>Bellewisp Support</b><span>Real people · we reply by email, usually within a few hours</span></div>
        <button class="oxc-x" type="button" aria-label="Close chat">×</button>
      </div>
      <div class="oxc-body">
        <div class="oxc-msg">Hi! 👋 Any question about your lashes, or trouble placing your order? Tell us and we'll get right back to you.</div>
        <div class="oxc-quick"></div>
        <form class="oxc-form" novalidate>
          <input class="oxc-in" type="email" name="email" placeholder="Your email (so we can reply)" required autocomplete="email">
          <textarea class="oxc-in" name="message" rows="3" placeholder="Type your message…" required></textarea>
          <input type="text" name="_honey" class="oxc-hp" tabindex="-1" autocomplete="off">
          <button class="oxc-send" type="submit">Send message</button>
          <p class="oxc-err" hidden></p>
        </form>
        <div class="oxc-done" hidden>✅ Thanks — got it! We'll reply to your email shortly.</div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const btn = root.querySelector(".oxc-btn");
  const panel = root.querySelector(".oxc-panel");
  const form = root.querySelector(".oxc-form");
  const msg = form.querySelector("textarea");
  const err = root.querySelector(".oxc-err");
  const quick = root.querySelector(".oxc-quick");

  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => { msg.value = q + ": "; msg.focus(); });
    quick.appendChild(b);
  });

  // phone Back button closes the chat instead of leaving the site
  let pushed = false;
  function setOpen(open, fromPop) {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    root.classList.toggle("open", open);
    document.documentElement.classList.toggle("oxc-lock", open);
    if (open) {
      if (!pushed) { try { history.pushState({ oxc: 1 }, ""); pushed = true; } catch (_) {} }
      // don't auto-focus on phones: the keyboard would cover the panel before it's seen
      if (window.matchMedia("(min-width: 761px)").matches) setTimeout(() => form.querySelector("input[type=email]").focus(), 50);
    } else if (pushed) {
      pushed = false;
      if (!fromPop) { try { history.back(); } catch (_) {} }
    }
  }
  window.addEventListener("popstate", () => { if (!panel.hidden) setOpen(false, true); else pushed = false; });
  btn.addEventListener("click", () => setOpen(panel.hidden));
  root.querySelector(".oxc-x").addEventListener("click", () => setOpen(false));
  // keep the focused field visible above the phone keyboard
  form.addEventListener("focusin", (e) => setTimeout(() => e.target.scrollIntoView({ block: "center" }), 300));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = form.email.value.trim();
    const text = msg.value.trim();
    const showErr = (t) => { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: "center" }); };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr("Please enter your email so we can reply."); form.email.focus(); return; }
    if (text.length < 2) { showErr("Please type a message."); msg.focus(); return; }
    if (form._honey.value) return;
    const send = form.querySelector(".oxc-send");
    send.disabled = true; send.textContent = "Sending…";
    const fields = {
      email, message: text,
      page: location.pathname + location.search.replace(/[?&](fbclid|gclid)=[^&]*/g, ""),
      _subject: "Bellewisp chat: " + text.slice(0, 50),
      _template: "table", _captcha: "false",
    };
    const done = () => {
      form.hidden = true; quick.hidden = true;
      root.querySelector(".oxc-done").hidden = false;
      if (window.fbq) fbq("track", "Contact");
      if (window.clarity) clarity("event", "chat_sent");
    };
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(ENDPOINT, {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fields),
      });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (!r.ok || String(data.success) !== "true") throw new Error(data.message || "HTTP " + r.status);
      done();
    } catch (e1) {
      // fallback for in-app browsers / blocked AJAX: a plain form post that the browser can't read back
      try {
        const fd = new URLSearchParams(fields);
        await fetch(ENDPOINT.replace("/ajax/", "/"), { method: "POST", mode: "no-cors", body: fd });
        if (window.clarity) clarity("event", "chat_fallback");
        done();
      } catch (e2) {
        showErr("Sorry, that didn't go through. Please check your connection and try again.");
        send.disabled = false; send.textContent = "Send message";
        if (window.clarity) clarity("event", "chat_failed");
      }
    }
  });
})();
