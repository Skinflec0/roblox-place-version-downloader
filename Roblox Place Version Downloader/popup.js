const $ = (id) => document.getElementById(id);
const msg = (t) => ($("msg").textContent = t);
const num = (v) => (/^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : null);

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const m = tabs[0] && tabs[0].url && tabs[0].url.match(/\/places\/(\d+)/);
  if (m) $("pid").value = m[1];
});

$("go").addEventListener("click", () => {
  const placeId = num($("pid").value), version = num($("ver").value);
  if (placeId === null || version === null) return msg("Enter a numeric Place ID and version.");
  msg("Downloading…");
  chrome.runtime.sendMessage({ type: "download-version", placeId, version }, (res) =>
    msg(res && res.ok ? "Saved." : "Failed: " + ((res && res.error) || "unknown error"))
  );
});

$("range").addEventListener("click", () => {
  const placeId = num($("pid").value), from = num($("from").value), to = num($("to").value);
  if (placeId === null || from === null || to === null || from > to) return msg("Enter a Place ID and a valid From/To range.");
  const n = to - from + 1;
  if (n > 25 && !confirm(`Download ${n} versions? This can take a while.`)) return;
  msg(`Downloading ${n} versions in the background… you can close this popup.`);
  chrome.runtime.sendMessage({ type: "download-range", placeId, from, to }, (res) => {
    if (res) msg(res.done !== undefined ? `Done: ${res.done}/${res.total} saved, ${res.failed} failed.` : res.error);
  });
});

