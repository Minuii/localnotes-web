# LocalNotes

**A local-first notes app** for notebooks, tasks, a calendar, files and pen whiteboards, in the style of OneNote and Evernote. Everything stays on your own device: no account, no cloud, no tracking.

| | Get it |
|---|---|
| 🪟 **Windows** | **[Download the latest version](https://github.com/Minuii/localnotes-web/releases/latest)**: the portable `.exe` (no install) or the installer |
| 📱 **iPad / tablet / any browser** | **[Open the web app](https://minuii.github.io/localnotes-web/)** and install it from the browser (see below) |

---

## Features

- **Notebooks, OneNote-style:** coloured sections, pages and subpages, headings as chapter points, a contents and A–Z **Index**, tags with a **Tags summary**, paper styles (ruled, grid, dots) and page colours.
- **Writing:** headings, lists, to-dos, links, and **LaTeX math** (`$x^2$` inline, `$$…$$` blocks, or Alt+=).
- **Pen and ink:** write right on pages, PDFs and slides with a stylus (pen tablet, Surface pen or Apple Pencil), with pressure. Scribble over ink to erase it, and rough circles, lines, boxes and triangles snap clean.
- **Whiteboards:** an infinite canvas with pen, highlighter, lasso select, sticky notes, text, images and PNG export.
- **Files:** PDFs you can write on and add sticky notes to, Markdown files, and **PowerPoint (.pptx) editing**.
- **Home:** a dashboard of widgets (notes, calendar, tasks, scratch pad, focus timer, habits, formula sheet, ink pad…) that you can drag, collapse and customise.
- **Scientific calculator** in a side panel, with fx-991-style features: trig, logs, powers, fractions, memories, 40 searchable scientific constants and unit conversions, ∫, d/dx, Σ, an equation solver (quadratic, cubic, 2 and 3 unknowns), statistics and regression, and tables with graphs you can put in your notes. Results can be inserted into a page.
- **Math answers, like Apple Math Notes:** type 12*4 + 7 = in a page and the answer appears (Tab, Enter or a tap keeps it); end an equation with = and it solves itself.
- **Themes and designs:** colour themes (Graphite, Maroon, Mauve, Midnight, Forest, Mocha) and background designs (roses, blossoms, leaves, stars).
- **Tasks and calendar**, plus **password-protected sections** that are encrypted on your device.
- **Keyboard shortcuts** for almost everything. Press **F1** in the app to see them all.

## Install

### Windows

1. Go to **[Releases](https://github.com/Minuii/localnotes-web/releases/latest)** and download one of these:
   - **`LocalNotes-x.y.z-portable.exe`**: no install. Just run it, from anywhere, even a USB stick.
   - **`LocalNotes-Setup-x.y.z.exe`**: installs LocalNotes with Start menu and desktop shortcuts, and updates itself.
2. Windows may say **"Windows protected your PC"** because the app isn't code-signed yet. Click **More info → Run anyway**.

When a new version comes out, the app tells you. The installer version downloads it and installs it when you restart. The portable version shows a link to download it.

### iPad

1. Open **https://minuii.github.io/localnotes-web/** in **Safari**.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Always open LocalNotes **from the Home Screen icon**. It runs full screen and works offline.

### Other devices

Open **https://minuii.github.io/localnotes-web/** in Chrome or Edge, on Android, a Chromebook, a Mac or a PC, and use **Install app** from the browser menu or the address bar. It also works as a normal web page.

## Pen and touch

| Do this | To |
|---|---|
| Write with a stylus | Draw ink (in **✒ Stylus draws** mode, the default) |
| Drag with one finger | Scroll a page, or pan on a whiteboard |
| Drag with two fingers | Scroll a page in **✒ Draw (all input)** mode, where one finger draws |
| Pinch | Zoom a whiteboard |
| Press and hold / right-click | Open the menu on a page or section |
| Ctrl+Shift+D | Switch between ⌨ Type only → ✒ Stylus draws → ✒ Draw with anything |

On iPad, switch to **⌨ Type only** and write with Apple Pencil: iPadOS **Scribble** turns your handwriting into typed text.

## Your data

- Your notes are stored **only on the device you use**. On Windows that's your user profile (`%APPDATA%\LocalNotes`); in the web app it's the browser's storage.
- **Updating or deleting the Windows `.exe` keeps your notes.** In the web app, **deleting the Home Screen app, or clearing the browser's site data, deletes its notes.**
- Back up now and then with **Settings → Export backup**. Nothing syncs between devices yet; to move notes, use **Export backup** on one device and **Import backup** on the other.

## Windows app vs web app

Both have almost everything. A few features need the Windows app, because a web page isn't allowed to do them:

| Feature | Windows | Web / iPad |
|---|---|---|
| Notebooks, writing, math, ink, whiteboards, files, tasks, calendar | ✅ | ✅ |
| Works offline | ✅ | ✅ (after the first visit) |
| Handwriting → text (the Aa button) | ✅ uses the Windows recognizer | ➖ use iPad Scribble instead |
| Sync Google / Outlook / iCloud calendars from an iCal link | ✅ | ❌ blocked by those servers |
| AI assistant and daily brief (DeepSeek, bring your own key) | ✅ | ❌ |
| Open a presentation in PowerPoint | ✅ | ➖ use Export |
| Automatic updates | ✅ | ✅ (the app refreshes itself) |

## Found a bug?

[Open an issue](https://github.com/Minuii/localnotes-web/issues) or message me. Say what you did, what you expected and what happened, and add a screenshot and your device and OS. **Settings → About → Report a problem** copies the technical details (never your notes).

---

*This repository holds the built web app, served at minuii.github.io/localnotes-web, and the Windows downloads under Releases.*
