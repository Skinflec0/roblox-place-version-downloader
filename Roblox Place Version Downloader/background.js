const API = "https://assetdelivery.roblox.com/v1/asset/";
const MIN_BYTES = 200; // smaller than this = almost certainly an error body

const sanitize = (s) =>
  String(s).replace(/[\\/:*?"<>|\x00-\x1f]+/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- names ---------------- */

async function getName(placeId, given) {
  const key = "n2_" + placeId;
  try { const o = await chrome.storage.local.get(key); if (o[key]) return o[key]; } catch (_) {}

  let name = null;
  try {
    const r = await fetch(`https://economy.roblox.com/v2/assets/${placeId}/details`, { credentials: "include" });
    if (r.ok) name = (await r.json()).Name;
  } catch (_) {}

  if (!name) {
    try {
      const u = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, { credentials: "include" });
      const uid = u.ok && (await u.json()).universeId;
      if (uid) {
        const g = await fetch(`https://games.roblox.com/v1/games?universeIds=${uid}`, { credentials: "include" });
        if (g.ok) name = ((await g.json()).data || [])[0]?.name;
      }
    } catch (_) {}
  }

  name = name && sanitize(name);
  if (name) {
    try { await chrome.storage.local.set({ [key]: name }); } catch (_) {}
    return name;
  }
  if (given) return sanitize(given);
  try { const o = await chrome.storage.local.get("name_" + placeId); if (o["name_" + placeId]) return sanitize(o["name_" + placeId]); } catch (_) {}
  return `place-${placeId}`;
}

/* ---------------- helpers ---------------- */

function httpError(status) {
  if (status === 401 || status === 403) return new Error("Roblox denied access. Log in and make sure you can edit this place.");
  if (status === 404 || status === 400) return new Error("That place/version could not be found.");
  if (status === 429) return new Error("Rate limited by Roblox. Wait a bit and try again.");
  return new Error("Roblox returned status " + status + ".");
}

// Ask Roblox first so real errors are reported instead of silently saving a tiny error file as .rbxl.
async function resolveUrl(url) {
  const ctrl = new AbortController();
  let r;
  try {
    r = await fetch(url, { credentials: "include", signal: ctrl.signal, redirect: "follow" });
  } catch (_) {
    return url; // network oddity: let the downloads API try directly
  }
  const finalUrl = r.url, status = r.status, ok = r.ok;
  ctrl.abort();
  if (!ok) throw httpError(status);
  return finalUrl || url;
}

function startDownload(url, filename) {
  return new Promise((res, rej) =>
    chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (id) =>
      chrome.runtime.lastError || id === undefined
        ? rej(new Error(chrome.runtime.lastError?.message || "Download failed"))
        : res(id)
    )
  );
}

function waitForDownload(id) {
  return new Promise((resolve) => {
    const onChanged = async (d) => {
      if (d.id !== id || !d.state) return;
      if (d.state.current === "complete") {
        chrome.downloads.onChanged.removeListener(onChanged);
        const [item] = await chrome.downloads.search({ id });
        if (item && item.fileSize > 0 && item.fileSize < MIN_BYTES)
          resolve({ ok: false, error: "File is only " + item.fileSize + " bytes, probably an error response." });
        else resolve({ ok: true, id, filename: item && item.filename });
      } else if (d.state.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(onChanged);
        resolve({ ok: false, error: "Download interrupted" + (d.error ? " (" + d.error.current + ")" : "") + "." });
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

/* ---------------- places (.rbxl) ---------------- */

// version = number for a specific saved version; null/undefined = latest published
async function downloadVersion({ placeId, version, name }) {
  try {
    const hasV = version !== null && version !== undefined && version !== "";
    const url = `${API}?id=${encodeURIComponent(placeId)}` + (hasV ? `&version=${encodeURIComponent(version)}` : "");
    const finalUrl = await resolveUrl(url);
    const placeName = await getName(placeId, name);
    const id = await startDownload(finalUrl, `${placeName}_${hasV ? "v" + version : "published"}.rbxl`);
    return await waitForDownload(id);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// Experience (universe) -> its start place -> latest published .rbxl
async function downloadUniverse({ universeId, name }) {
  try {
    let rootPlaceId = null, expName = name || null;
    try {
      const r = await fetch(`https://develop.roblox.com/v1/universes/${universeId}`, { credentials: "include" });
      if (r.ok) { const j = await r.json(); rootPlaceId = j.rootPlaceId; expName = j.name || expName; }
    } catch (_) {}
    if (!rootPlaceId) {
      try {
        const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { credentials: "include" });
        if (r.ok) { const g = ((await r.json()).data || [])[0]; if (g) { rootPlaceId = g.rootPlaceId; expName = g.name || expName; } }
      } catch (_) {}
    }
    if (!rootPlaceId) throw new Error("Couldn't find this experience's start place.");
    if (expName) { try { await chrome.storage.local.set({ ["n2_" + rootPlaceId]: sanitize(expName) }); } catch (_) {} }
    return await downloadVersion({ placeId: rootPlaceId, version: null, name: expName });
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

let rangeRunning = false;
async function downloadRange({ placeId, from, to, name }) {
  if (rangeRunning) return { ok: false, error: "A range download is already running." };
  rangeRunning = true;
  let done = 0, failed = 0;
  const total = to - from + 1;
  try {
    for (let v = from; v <= to; v++) {
      chrome.action.setBadgeBackgroundColor({ color: "#335fff" });
      chrome.action.setBadgeText({ text: String(to - v + 1) });
      const res = await downloadVersion({ placeId, version: v, name });
      res.ok ? done++ : failed++;
      await sleep(1200);
    }
  } finally {
    rangeRunning = false;
    chrome.action.setBadgeBackgroundColor({ color: failed ? "#f85149" : "#3fb950" });
    chrome.action.setBadgeText({ text: failed ? "!" : "✓" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 6000);
  }
  return { ok: failed === 0, done, failed, total };
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (!msg) return;
  if (msg.type === "download-version") { downloadVersion(msg).then(sendResponse); return true; }
  if (msg.type === "download-range") { downloadRange(msg).then(sendResponse); return true; }
  if (msg.type === "download-universe") { downloadUniverse(msg).then(sendResponse); return true; }
});

// Safety net: whatever name Roblox's CDN suggests, force .rbxl on our downloads.
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId !== chrome.runtime.id) return;
  let name = (item.filename || "").split(/[\\/]/).pop() || "place";
  if (!/\.rbxl$/i.test(name)) name = name.replace(/\.[A-Za-z0-9]{1,5}$/, "") + ".rbxl";
  suggest({ filename: name, conflictAction: "uniquify" });
});
