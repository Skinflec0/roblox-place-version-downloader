(function () {
  const DL = "M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z";
  const CHECK = "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";
  const WARN = "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z";
  const SPIN = "M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z";
  const SKIP = 'nav, header, aside, table, [role="navigation"], [aria-label*="readcrumb" i]';

  // Only the dashboard grids (Development items, Experiences, an experience's Places list)
  const isGridPage = () =>
    /^\/dashboard\/creations\/?$/.test(location.pathname) || /\/experiences\/\d+\/places\/?$/.test(location.pathname);

  function parse(a) {
    let p;
    try { p = new URL(a.getAttribute("href"), location.href).pathname; } catch (_) { return null; }
    let m = p.match(/\/places\/(\d+)(?:\/|$)/);
    if (m) return { kind: "place", id: m[1] };
    m = p.match(/\/experiences\/(\d+)(?:\/|$)/);
    if (m) return { kind: "universe", id: m[1] };
    return null;
  }

  function cardOf(a) {
    const big = (el) => el.getBoundingClientRect().width > 420;
    let c = a.closest('li, [role="listitem"], [class*="Grid-item"]') || a;
    if (big(c)) c = a;
    if (big(c) || c.getBoundingClientRect().width < 80) return null;
    return c;
  }

  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"></path></svg>`;

  let toastTimer;
  function toast(text, err) {
    let t = document.getElementById("rbxvd-toast");
    if (!t) { t = document.createElement("div"); t.id = "rbxvd-toast"; document.body.appendChild(t); }
    t.textContent = text;
    t.className = err ? "rbxvd-err" : "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), err ? 6000 : 3000);
  }

  function request(item) {
    const msg =
      item.kind === "place" ? { type: "download-version", placeId: item.id, version: null } :
      { type: "download-universe", universeId: item.id };
    return new Promise((resolve) =>
      chrome.runtime.sendMessage(msg, (res) =>
        resolve(chrome.runtime.lastError ? { ok: false, error: "Extension was reloaded. Refresh the page." } : res || { ok: false, error: "No response" })
      )
    );
  }

  const tip = (item) =>
    item.kind === "place" ? "Download this place (latest published) as .rbxl" :
    "Download this experience's start place (latest published) as .rbxl";

  function makeBtn(item) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rbxvd-card-btn";
    b.dataset.kind = item.kind;
    b.dataset.id = item.id;
    b.title = tip(item);
    b.setAttribute("aria-label", b.title);
    b.innerHTML = icon(DL);
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"].forEach((n) => b.addEventListener(n, (e) => e.stopPropagation()));
    b.addEventListener("click", async (e) => {
      stop(e);
      if (b.disabled) return;
      const res = await runOne(b, item);
      toast(res.ok ? "Saved" + (res.filename ? ": " + res.filename.split(/[\\/]/).pop() : "") : "Download failed: " + res.error, !res.ok);
    });
    return b;
  }

  async function runOne(b, item) {
    b.disabled = true;
    b.classList.add("rbxvd-busy");
    b.innerHTML = icon(SPIN);
    const res = await request(item);
    b.classList.remove("rbxvd-busy");
    b.disabled = false;
    b.classList.add(res.ok ? "rbxvd-ok" : "rbxvd-err");
    b.innerHTML = icon(res.ok ? CHECK : WARN);
    if (!res.ok) b.title = res.error;
    setTimeout(() => { b.classList.remove("rbxvd-ok", "rbxvd-err"); b.innerHTML = icon(DL); b.title = tip(item); }, res.ok ? 2500 : 5000);
    return res;
  }

  // Single place/experience pages: one floating button
  function pageItem() {
    if (isGridPage() || /version-history/.test(location.pathname)) return null;
    let m = location.pathname.match(/\/places\/(\d+)/);
    if (m) return { kind: "place", id: m[1] };
    m = location.pathname.match(/\/experiences\/(\d+)/);
    if (m) return { kind: "universe", id: m[1] };
    return null;
  }

  function updatePageBtn() {
    const item = pageItem();
    let b = document.getElementById("rbxvd-page");
    if (!item) { if (b) b.remove(); return; }
    if (b && b.dataset.key === item.kind + item.id) return;
    if (b) b.remove();
    b = document.createElement("button");
    b.id = "rbxvd-page";
    b.type = "button";
    b.dataset.key = item.kind + item.id;
    b.title = tip(item);
    b.innerHTML = icon(DL) + "<span>Download place</span>";
    b.addEventListener("click", async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.querySelector("span").textContent = "Downloading…";
      const res = await request(item);
      b.disabled = false;
      b.querySelector("span").textContent = "Download place";
      toast(res.ok ? "Saved" + (res.filename ? ": " + res.filename.split(/[\\/]/).pop() : "") : "Download failed: " + res.error, !res.ok);
    });
    document.body.appendChild(b);
  }

  function scan() {
    updatePageBtn();
    if (!isGridPage()) {
      document.querySelectorAll(".rbxvd-card-btn").forEach((n) => n.remove());
      const bulk = document.getElementById("rbxvd-bulk"); if (bulk) bulk.remove();
      return;
    }
    document.querySelectorAll("a[href]").forEach((a) => {
      if (a.closest(SKIP)) return;
      const item = parse(a);
      if (!item) return;
      const card = cardOf(a);
      if (!card || card.querySelector(".rbxvd-card-btn")) return;
      if (getComputedStyle(card).position === "static") card.style.position = "relative";
      card.appendChild(makeBtn(item));
    });
    updateBulk();
  }

  /* ---------- download everything currently on the page ---------- */
  let running = false, cancel = false;

  function items() {
    const seen = new Set(), out = [];
    document.querySelectorAll(".rbxvd-card-btn").forEach((b) => {
      const k = b.dataset.kind + ":" + b.dataset.id;
      if (!seen.has(k)) { seen.add(k); out.push({ kind: b.dataset.kind, id: b.dataset.id, btn: b }); }
    });
    return out;
  }

  function updateBulk() {
    const n = items().length;
    let bulk = document.getElementById("rbxvd-bulk");
    if (!n) { if (bulk) bulk.remove(); return; }
    if (!bulk) {
      bulk = document.createElement("button");
      bulk.id = "rbxvd-bulk";
      bulk.type = "button";
      bulk.addEventListener("click", runAll);
      document.body.appendChild(bulk);
    }
    if (!running) bulk.innerHTML = icon(DL) + `<span>Download all (${n})</span>`;
  }

  async function runAll() {
    const bulk = document.getElementById("rbxvd-bulk");
    if (running) { cancel = true; return; }
    const list = items();
    const heavy = true;
    if (list.length > (heavy ? 5 : 25) && !confirm(`Download ${list.length} items${heavy ? " (places can be large)" : ""}?`)) return;
    running = true; cancel = false;
    bulk.classList.add("rbxvd-running");
    let ok = 0, fail = 0, lastErr = "";
    for (let i = 0; i < list.length && !cancel; i++) {
      bulk.innerHTML = icon(SPIN) + `<span>${i + 1}/${list.length} (click to stop)</span>`;
      const res = await runOne(list[i].btn, list[i]);
      if (res.ok) ok++; else { fail++; lastErr = res.error; }
      await new Promise((r) => setTimeout(r, 700));
    }
    running = false;
    bulk.classList.remove("rbxvd-running");
    toast(`${cancel ? "Stopped. " : ""}${ok} saved, ${fail} failed${fail ? " (" + lastErr + ")" : ""}`, fail > 0);
    updateBulk();
  }

  let timer = null;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 200); })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });
  scan();
})();
