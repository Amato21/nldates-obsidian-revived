# Natural Language Dates (Revived) 🌍

This is a **revived and improved version** of the popular "Natural Language Dates" plugin for Obsidian.
It brings the plugin back to life with a modern engine, true multilingual support, and smarter time handling.

## ✨ New Features in v0.8.0
* **🌍 Multilingual Support:** Now supports **English, French, German, Japanese, Dutch, and Portuguese**!
    * *Examples:* `@demain`, `@dans 20 minutes`, `@Lundi prochain`, `@next friday`.
* **🧠 Smart Time Parsing:** The plugin intelligently detects if you included a time in your sentence.
* **🔗 Hybrid Links:**
    * Dates without time: `[[2024-12-30]]`
    * Dates **with** time: `[[2024-12-30]] 23:45` (Keeps your graph clean!).

---

## 🚀 How to Install

### Via BRAT (Recommended for now)
Since this is a new fork, the quickest way to get updates is via the **BRAT** plugin:
1.  Install **BRAT** from the Community Plugins store.
2.  Add a Beta Plugin with this URL: `https://github.com/Amato21/nldates-obsidian-revived`
3.  Enjoy!

---

## ✍️ Usage

### Date Autosuggest
Type `@` (default trigger) followed by a natural date.

* `@today` → `[[2024-12-30]]`
* `@tomorrow` → `[[2024-12-31]]`
* `@in 20 minutes` → `[[2024-12-30]] 23:50`

Press <kbd>Shift</kbd> + <kbd>Enter</kbd> to keep the original text as an alias (e.g. `[[2024-12-30|today]]`).

### Commands (Ctrl/Cmd + P)
* **Parse natural language date:** Replaces selected text with a link (e.g. select "demain" -> becomes `[[2024-12-31]]`).
* **Insert current date/time:** Quickly insert timestamps.
* **Date Picker:** Opens a calendar view to pick a date visually.

### Configuration
Go to **Settings > Natural Language Dates**:
* **Languages:** Check the languages you want to enable.
* **Date Format:** How the date part looks (e.g. `YYYY-MM-DD`).
* **Time Format:** How the time part looks (e.g. `HH:mm`).
* **Separator:** Character between date and time (if used).

---

## 🙏 Credits & Acknowledgements

This project stands on the shoulders of giants. Huge thanks to:

* **[Argentina Ortega Sainz (argenos)](https://github.com/argenos):** The original creator of this plugin. This revival is based on their excellent work.
* **[RensOliemans](https://github.com/RensOliemans):** For the major contributions and foundational work on the multilingual support.
* **Amato21:** Maintainer of this "Revived" version.

Powered by the [chrono-node](https://github.com/wanasit/chrono) library.

---

## 🔧 For Developers & URI

The plugin creates a global object for use in other plugins or via Obsidian URI.

**URI Action:** `obsidian://nldates?day=tomorrow&newPane=yes`

**API Usage:**
```ts
const nldatesPlugin = app.plugins.getPlugin("nldates-obsidian");
const parsedResult = nldatesPlugin.parseDate("next year");
console.log(parsedResult.moment.format("YYYY"));