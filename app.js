// Bellewisp store logic
// Checkout: PayPal hosted payment links (same setup as OxiRenew — works in the
// Instagram/Facebook in-app browser, card form without a PayPal account).
// Optional: per-style links, e.g. "2kit-40D". If a style-specific link is
// missing, the bundle link is used and the style is collected on thank-you.
const CHECKOUT_LINKS = {
  "1kit": "https://www.paypal.com/ncp/payment/XAFCPS2M8TDQA",
  "2kit": "https://www.paypal.com/ncp/payment/AGEFMELQDE336",
  "3kit": "https://www.paypal.com/ncp/payment/8BUT87QJ5MVRN",
};
// Created 19.11.2026 in the same PayPal business account as OxiRenew ("Dollar IM Dot Com",
// statement name DOLLARIMDOT): shipping address on, auto-return to /thank-you.html.

const BUNDLES = {
  "1kit": { label: "1 kit", price: "$69", value: 69.00, kits: 1 },
  "2kit": { label: "2 kits", price: "$109", value: 109.00, kits: 2 },
  "3kit": { label: "3 kits", price: "$139", value: 139.00, kits: 3 },
};
const STYLE_NAMES = { "30D": "Natural 30D", "40D": "Fluffy 40D", "50D": "Dramatic 50D" };

let selectedSku = "1kit";
let selectedStyle = "30D";

function updateSticky() {
  const b = BUNDLES[selectedSku];
  const el = document.getElementById("sticky-price");
  if (el) el.innerHTML = `${b.price} <small>${b.label} · ${STYLE_NAMES[selectedStyle]}</small>`;
}

document.querySelectorAll(".bundle").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".bundle").forEach((b) => b.classList.remove("selected"));
    el.classList.add("selected");
    selectedSku = el.dataset.sku;
    updateSticky();
  });
});
document.querySelectorAll("#picker button").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll("#picker button").forEach((b) => b.classList.remove("on"));
    el.classList.add("on");
    selectedStyle = el.dataset.style;
    updateSticky();
  });
});

// ---- bundle upsell (once per visit, never nags) ----
const UPSELLS = {
  "1kit": {
    body: "A set lasts several days, so if you'll wear clusters every week you'll go through a kit fast. A second kit means you won't run out of clusters or bond — one order, one delivery.",
    options: [
      { sku: "2kit", title: "2 Kits", note: "$54.50 per kit · save $29" },
      { sku: "3kit", title: "3 Kits", note: "$46.33 per kit · save $68 · mix styles" },
    ],
    decline: "No thanks, 1 kit is enough",
  },
  "2kit": {
    body: "Want to try another density too? The 3-kit bundle is the lowest price per kit, and you can mix Natural, Fluffy and Dramatic.",
    options: [{ sku: "3kit", title: "3 Kits", note: "$46.33 per kit · save $68" }],
    decline: "No thanks, keep 2 kits",
  },
};
let upsellShown = false;
try { upsellShown = sessionStorage.getItem("bw_up") === "1"; } catch (_) {}

function sendPixelKeepalive(ev, data, eid) {
  try {
    const id = window.META_PIXEL_ID;
    if (!id) return;
    const q = new URLSearchParams({ id, ev, eid, dl: location.href, rl: document.referrer || "", ts: String(Date.now()), noscript: "1" });
    Object.keys(data).forEach((k) => {
      const v = data[k];
      q.append("cd[" + k + "]", Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    fetch("https://www.facebook.com/tr/?" + q.toString(), { mode: "no-cors", keepalive: true, credentials: "include" }).catch(() => {});
  } catch (_) {}
}

function goCheckout(sku) {
  const b = BUNDLES[sku];
  const link = CHECKOUT_LINKS[sku + "-" + selectedStyle] || CHECKOUT_LINKS[sku];
  try {
    localStorage.setItem("bw_pending", JSON.stringify({ sku, style: selectedStyle, value: b.value, ts: Date.now() }));
  } catch (_) {}
  if (!link) { alert("Checkout is being set up — please check back shortly."); return; }
  const icData = { value: b.value, currency: "USD", content_name: sku + " " + selectedStyle, content_ids: [sku], content_type: "product", num_items: b.kits || 1 };
  const eid = "ic_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  if (window.fbq) fbq("track", "InitiateCheckout", icData, { eventID: eid });
  // Pixel request needs a moment before the page leaves for PayPal (OxiRenew lesson, 18.11).
  // Verified 20.11: InitiateCheckout arrives in Events Manager. sendPixelKeepalive() is kept as a
  // fallback but NOT used, to avoid double-counting (pixel-to-pixel eventID dedup isn't guaranteed).
  if (window.clarity) clarity("event", "checkout_click");
  const btns = document.querySelectorAll("#checkout-btn, #sticky-btn, .up-opt, #up-no");
  btns.forEach((x) => { x.disabled = true; });
  setTimeout(() => { location.href = link; }, 700);
}

// Upsell modal. Mobile lesson (Ronen 19.11): the phone's Back button must close the
// popup, not leave the site. Opening pushes a history entry; Back (popstate) closes it.
const upModal = document.getElementById("upsell");
function openUpsell() {
  upModal.hidden = false;
  try { history.pushState({ bwUp: 1 }, ""); } catch (_) {}
}
function closeUpsell(viaBack) {
  if (upModal.hidden) return;
  upModal.hidden = true;
  if (!viaBack && history.state && history.state.bwUp) { try { history.back(); } catch (_) {} }
}
window.addEventListener("popstate", () => closeUpsell(true));
upModal.addEventListener("click", (e) => { if (e.target === upModal) closeUpsell(false); });
document.getElementById("up-x").addEventListener("click", () => closeUpsell(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeUpsell(false); });

function leaveModalForCheckout() {
  // Drop the pushed entry's marker so returning from PayPal doesn't need two Backs to reopen anything.
  upModal.hidden = true;
  try { if (history.state && history.state.bwUp) history.replaceState(null, ""); } catch (_) {}
}

function startCheckout() {
  const up = UPSELLS[selectedSku];
  if (!up || upsellShown) return goCheckout(selectedSku);
  upsellShown = true;
  try { sessionStorage.setItem("bw_up", "1"); } catch (_) {}
  document.getElementById("up-body").textContent = up.body;
  const opts = document.getElementById("up-opts");
  opts.innerHTML = "";
  up.options.forEach((o) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "up-opt";
    btn.innerHTML = `<span><b>${o.title}</b><small>${o.note}</small></span><span class="pr">${BUNDLES[o.sku].price}</span>`;
    btn.addEventListener("click", () => {
      selectedSku = o.sku;
      document.querySelectorAll(".bundle").forEach((x) => x.classList.toggle("selected", x.dataset.sku === o.sku));
      updateSticky();
      leaveModalForCheckout(); goCheckout(o.sku);
    });
    opts.appendChild(btn);
  });
  const no = document.getElementById("up-no");
  no.textContent = up.decline;
  no.onclick = () => { leaveModalForCheckout(); goCheckout(selectedSku); };
  openUpsell();
}
document.getElementById("checkout-btn").addEventListener("click", startCheckout);
// Sticky bar checks out directly with the current choice (OxiRenew mobile lesson, 18.11).
document.getElementById("sticky-btn").addEventListener("click", startCheckout);
// Back from PayPal (bfcache): re-enable the checkout buttons and make sure the popup is closed.
window.addEventListener("pageshow", () => {
  document.querySelectorAll("#checkout-btn, #sticky-btn, .up-opt, #up-no").forEach((x) => { x.disabled = false; });
  upModal.hidden = true;
});

// ---- reviews (real verified-buyer reviews of this exact kit from AliExpress, see assets/reviews.json) ----
const PAGE = 9;
let allRevs = [], shown = 0, filter = "all";
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function filtered() {
  if (filter === "all") return allRevs;
  if (/^\d$/.test(filter)) return allRevs.filter((r) => String(r.s) === filter);
  return allRevs.filter((r) => r.v === filter);
}
function render(reset) {
  const grid = document.getElementById("rev-grid");
  if (reset) { grid.innerHTML = ""; shown = 0; }
  const list = filtered();
  list.slice(shown, shown + PAGE).forEach((r) => {
    const d = document.createElement("div");
    d.className = "rev";
    d.innerHTML = `<div class="top"><span class="stars">${"★".repeat(r.s)}${"☆".repeat(5 - r.s)}</span><span>${esc(r.d)}</span></div>
      <p>${esc(r.t)}</p><div class="meta">${esc(r.n)} · <b>✓ Verified buyer</b>${r.v ? " · " + STYLE_NAMES[r.v] : ""}</div>`;
    grid.appendChild(d);
  });
  shown += PAGE;
  document.getElementById("rev-more").style.display = shown >= list.length ? "none" : "block";
}
fetch("assets/reviews.json").then((r) => r.json()).then((data) => {
  allRevs = data;
  const avg = data.reduce((a, r) => a + r.s, 0) / data.length;
  document.getElementById("rev-avg").textContent = avg.toFixed(1);
  document.getElementById("rev-n").textContent = `${data.length} written reviews shown`;
  render(true);
}).catch(() => {});
document.getElementById("rev-more").addEventListener("click", () => render(false));
document.querySelectorAll("#rev-filter button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#rev-filter button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); filter = b.dataset.f; render(true);
  });
});
