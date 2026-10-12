# LocalNotes

**A local-first notes app** for notebooks, tasks, a calendar and pen whiteboards, in the style of OneNote and Evernote. Everything stays on your own device: no account, no cloud, no tracking.

👉 **Open it: https://minuii.github.io/localnotes-web/**

This repository is the **web / iPad version**. It's the same app as the Windows desktop version, packaged as an installable web app that works offline.

---

## Install on iPad

1. Open **https://minuii.github.io/localnotes-web/** in **Safari**.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Always open LocalNotes **from the Home Screen icon**. It runs full screen and works without internet.

It also runs in any modern browser on a computer. In Chrome or Edge, use the install icon in the address bar.

## What's inside

- **Notebooks, OneNote-style:** coloured sections, pages and subpages, headings as chapter points, a contents and A–Z **Index**, tags with a **Tags summary**, paper styles (ruled, grid, dots) and page colours.
- **Writing:** headings, lists, to-dos, links, and **LaTeX math** (`$x^2$` inline, `$$…$$` blocks, or Alt+=).
- **Pen and ink:** write right on pages, PDFs and slides with **Apple Pencil** (pressure-sensitive). Scribble over ink to erase it, and rough circles, lines, boxes and triangles snap clean.
- **Whiteboards:** an infinite canvas with pen, highlighter, lasso select, sticky notes, text, images and PNG export.
- **Files:** PDFs you can write on and add sticky notes to, Markdown files, and **PowerPoint (.pptx) editing**.
- **Home:** a dashboard of widgets (notes, calendar, tasks, scratch pad, focus timer, habits, formula sheet, ink pad…) that you can drag, collapse and customise.
- **Tasks and calendar**, plus **password-protected sections** that are encrypted on the device.

## Using it with touch and Apple Pencil

| Do this | To |
|---|---|
| Write with the Pencil | Draw ink (in **✒ Stylus draws** mode, the default) |
| Drag with one finger | Scroll, or pan on a whiteboard |
| Pinch with two fingers | Zoom a whiteboard |
| Press and hold | Open the menu (like right-click), e.g. on a page or section |
| Switch to **⌨ Type only** and write with the Pencil | iPadOS **Scribble** turns your handwriting into typed text |
| Use a keyboard | Shortcuts work with **Cmd** where Windows uses Ctrl |

## Your data

- Notes are stored **only on the device you use**, in the browser's storage. On iPad that's the Home Screen app. A Safari tab has separate storage.
- **Deleting the Home Screen icon deletes its notes.** Use **Settings → Export backup** now and then, and keep the `.json` in Files or iCloud Drive.
- Nothing syncs between devices yet. To move notes, use **Export backup** on one device and **Import backup** on the other.

## Web version vs Windows app

The web version has almost everything. These parts need the **Windows desktop app**, because a web page isn't allowed to do them:

- Handwriting → text (the Aa button). On iPad, use Scribble instead.
- Syncing Google, iCloud or Outlook calendars from an iCal link
- The DeepSeek AI assistant and AI daily brief
- "Open in PowerPoint" (use **Export** to save the .pptx instead)

## Found a bug?

Tell me what you did, what you expected, and what happened, with a screenshot. Add your device and OS version (on iPad: Settings → General → About). **Settings → About → Report a problem** copies the technical details (never your notes).

---

*This repository only contains the built web app. It's published automatically from the LocalNotes project.*
