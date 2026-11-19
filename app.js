// Bellewisp store logic
// Checkout: PayPal hosted payment links (same setup as OxiRenew — works in the
// Instagram/Facebook in-app browser, card form without a PayPal account).
// Ronen creates one link per bundle in PayPal → Payment Links, with the return
// URL set to https://<domain>/thank-you.html, and pastes them here.
// Optional: per-style links, e.g. "2kit-40D". If a style-specific link is
// missing, the bundle link is used and the style is collected on thank-you.
const CHECKOUT_LINKS = {
  "1kit": "",
  "2kit": "",
  "3kit": "",
};

const BUNDLES = {
  "1kit": { label: "1 kit", price: "$29.95", value: 29.95 },
  "2kit": { label: "2 kits", price: "$44.95", value: 44.95 },
  "3kit": { label: "3 kits", price: "$59.95", value: 59.95 },
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
      { sku: "2kit", title: "2 Kits", note: "$22.48 per kit · save $14.95" },
      { sku: "3kit", title: "3 Kits", note: "$19.98 per kit · save $29.90 · mix styles" },
    ],
    decline: "No thanks, 1 kit is enough",
  },
  "2kit": {
    body: "Want to try another density too? The 3-kit bundle is the lowest price per kit, and you can mix Natural, Fluffy and Dramatic.",
    options: [{ sku: "3kit", title: "3 Kits", note: "$19.98 per kit · save $29.90" }],
    decline: "No thanks, keep 2 kits",
  },
};
let upsellShown = false;
try { upsellShown = sessionStorage.getItem("bw_up") === "1"; } catch (_) {}

function goCheckout(sku) {
  const b = BUNDLES[sku];
  const link = CHECKOUT_LINKS[sku + "-" + selectedStyle] || CHECKOUT_LINKS[sku];
  try {
    localStorage.setItem("bw_pending", JSON.stringify({ sku, style: selectedStyle, value: b.value, ts: Date.now() }));
  } catch (_) {}
  if (window.fbq) fbq("track", "InitiateCheckout", { value: b.value, currency: "USD", content_name: sku + " " + selectedStyle });
  if (!link) { alert("Checkout is being set up — please check back shortly."); return; }
  location.href = link;
}

function startCheckout() {
  const up = UPSELLS[selectedSku];
  if (!up || upsellShown) return goCheckout(selectedSku);
  upsellShown = true;
  try { sessionStorage.setItem("bw_up", "1"); } catch (_) {}
  const modal = document.getElementById("upsell");
  document.getElementById("up-body").textContent = up.body;
  const opts = document.getElementById("up-opts");
  opts.innerHTML = "";
  up.options.forEach((o) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "up-opt";
    btn.innerHTML = `<span><b>${o.title}</b><small>${o.note}</small></span><span class="pr">${BUNDLES[o.sku].price}</span>`;
    btn.addEventListener("click", () => { selectedSku = o.sku; modal.hidden = true; goCheckout(o.sku); });
    opts.appendChild(btn);
  });
  const no = document.getElementById("up-no");
  no.textContent = up.decline;
  no.onclick = () => { modal.hidden = true; goCheckout(selectedSku); };
  modal.hidden = false;
}
document.getElementById("checkout-btn").addEventListener("click", startCheckout);
// Sticky bar checks out directly with the current choice (OxiRenew mobile lesson, 18.11).
document.getElementById("sticky-btn").addEventListener("click", startCheckout);

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
