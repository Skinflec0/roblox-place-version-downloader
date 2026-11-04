# Roblox Place Version Downloader

Chrome extension that lets you download Roblox places as `.rbxl` files directly from the Creator Dashboard.

- Download any version from **Version History**
- One-click download of places and experiences from the dashboard grids
- Bulk download everything currently visible on the page
- Download a range of versions from the popup

---

### Features

| Feature | Description |
|---------|-------------|
| **Version History buttons** | Adds a "Download" button next to every version on the place Version History page |
| **Dashboard cards** | Small download button appears on every place / experience card |
| **Download all** | Floating button that downloads every place/experience currently visible |
| **Popup** | Manually enter a Place ID + version, or download a version range |
| **Smart naming** | Files are named after the place (e.g. `My Game_v142.rbxl`) |

---

### Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the folder containing these files

---

### How to use

**From Version History**
1. Open any place → Version History
2. Click the **Download** button next to the version you want

**From the Creator Dashboard**
- Hover over any place or experience card → click the download icon
- Or click the blue **Download all** button in the bottom-right corner

**From the popup**
1. Click the extension icon
2. Enter a Place ID
3. Enter a single version number **or** a From/To range
4. Click Download

---

### Permissions

- `downloads` – to save the `.rbxl` files
- `storage` – to remember place names
- Access to `create.roblox.com` and Roblox asset APIs (required to fetch the place files)

---

### Notes

- You must be logged into Roblox and have edit access to the place
- Some very old or restricted places may fail with a 403
- Bulk downloads are intentionally slowed down a bit to avoid rate limits

---

### License

MIT