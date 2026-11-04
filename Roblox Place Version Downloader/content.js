(function () {
  const PLACE_RE = /\/places\/(\d+)\/version-history/;
  const TPL_KEY = "rbxvd-tpl";
  // Material "Download" icon (same icon family Roblox's dashboard uses)
  const DL_PATH = "M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const getPlaceId = () => (location.pathname.match(PLACE_RE) || [])[1] || null;

  function getPlaceName() {
    try {
      const nav = document.querySelector('[aria-label="breadcrumb" i], nav');
      if (!nav) return null;
      const parts = nav.innerText.split(/\s*\/\s*|\n+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 2];
    } catch (_) {}
    return null;
  }

  function rememberName() {
    const id = getPlaceId(), name = getPlaceName();
    if (id && name && !/^(places|creations)$/i.test(name)) {
      try { chrome.storage.local.set({ ["name_" + id]: name }); } catch (_) {}
    }
  }

  // ---- Build a button that looks exactly like Roblox's own Restore button ----
  function findNativeTemplate() {
    const icon = document.querySelector('tbody [data-testid="RestoreIcon"]');
    const btn = icon && icon.closest("button");
    if (btn) {
      try { sessionStorage.setItem(TPL_KEY, btn.outerHTML); } catch (_) {}
      return btn.outerHTML;
    }
    try { return sessionStorage.getItem(TPL_KEY); } catch (_) { return null; }
  }

  function makeButton() {
    const html = findNativeTemplate();
    let btn;
    if (html) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      btn = tmp.firstElementChild;
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.setAttribute("data-testid", "DownloadIcon");
        const p = svg.querySelector("path");
        if (p) p.setAttribute("d", DL_PATH);
      }
      btn.querySelectorAll(".MuiTouchRipple-root").forEach((n) => n.remove());
      setLabel(btn, "Download");
    } else {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rbxvd-fallback";
      btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${DL_PATH}"></path></svg><span class="rbxvd-label">Download</span>`;
    }
    btn.classList.add("rbxvd-btn");
    return btn;
  }

  function setLabel(btn, text) {
    const holder = btn.querySelector(".rbxvd-label");
    if (holder) { holder.textContent = text; return; }
    const box = btn.querySelector("span") || btn;
    const last = box.lastChild;
    if (last && last.nodeType === 3) last.textContent = " " + text;
    else box.appendChild(document.createTextNode(" " + text));
  }

  function flash(btn, text, cls, ms) {
    setLabel(btn, text);
    btn.classList.add(cls);
    btn.disabled = false;
    setTimeout(() => { setLabel(btn, "Download"); btn.classList.remove("rbxvd-ok", "rbxvd-err"); }, ms);
  }

  function attach(row, version) {
    const btn = makeButton();
    btn.title = `Download version ${version} as .rbxl`;
    btn.setAttribute("aria-label", `Download version ${version}`);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const placeId = getPlaceId();
      if (!placeId) return;
      btn.disabled = true;
      setLabel(btn, "Downloading…");
      chrome.runtime.sendMessage(
        { type: "download-version", placeId, version, name: getPlaceName() },
        (res) => {
          if (chrome.runtime.lastError) {
            flash(btn, "Reload page", "rbxvd-err", 3500);
            return;
          }
          if (res && res.ok) flash(btn, "Saved", "rbxvd-ok", 2500);
          else {
            btn.title = (res && res.error) || "Download failed";
            console.warn("[RBX version downloader]", btn.title);
            flash(btn, "Failed", "rbxvd-err", 4000);
          }
        }
      );
    });
    const cells = row.querySelectorAll("td");
    cells[cells.length - 1].appendChild(btn);
  }

  function addButtons() {
    if (!getPlaceId()) return;
    rememberName();
    document.querySelectorAll("tbody tr").forEach((row) => {
      if (row.querySelector(".rbxvd-btn")) return;
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      const tid = (row.getAttribute("data-testid") || "").match(/version-history-(\d+)/);
      const version = tid ? tid[1] : cells[0].textContent.trim();
      if (!/^\d+$/.test(version)) return;
      attach(row, version);
    });
  }

  // The dashboard is a React SPA (rows re-render on paging / toggling), so keep watching.
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addButtons, 120);
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  addButtons();
})();
