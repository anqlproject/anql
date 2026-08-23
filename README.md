<p align="center">
  <img src="assets/logo_1024.png" alt="ANQL" height="120" />
</p>

<h1 align="center">ANQL</h1>

<p align="center">
  <strong>The workspace where your notes think alongside you.</strong><br/>
  Write. Calculate. Organize. All in one place — without switching apps.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.2.0-blue" style="pointer-events: none;" />
  <img alt="Status" src="https://img.shields.io/badge/status-active__development-orange" style="pointer-events: none;" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-lightgrey" style="pointer-events: none;" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" style="pointer-events: none;" />
</p>

<p align="center">
  <a href="#why-anql">Why ANQL?</a> |
  <a href="#features">Features</a> |
  <a href="#getting-started">Getting Started</a> |
  <a href="#technical-details">Technical Details</a> |
  <a href="CONTRIBUTING.md">Contributing</a> |
  <a href="#community">Community</a>
</p>

<br />

![ANQL main interface showing document editor with math calculations and tables](assets/overview.png)

<p align="center">
  <img src="assets/overview 1.png" alt="ANQL interface showing document list and sidebar navigation" width="45%" />
  <img src="assets/overview 2.png" alt="ANQL interface showing math panel with live calculations" width="45%" />
</p>

---

## See it in action

<table>
  <tr>
    <td align="center" width="33%">
      <strong>Create a document</strong><br/><br/>
      <img src="assets/create new document.gif" alt="Create new document" />
    </td>
    <td align="center" width="33%">
      <strong>Live math calculations</strong><br/><br/>
      <img src="assets/math panel.gif" alt="Live math panel" />
    </td>
    <td align="center" width="33%">
      <strong>Math with variables</strong><br/><br/>
      <img src="assets/math panel use variable.gif" alt="Math panel using variables" />
    </td>
  </tr>
</table>

<p align="center">
  <a href="QuickStart.md">→ See all demos</a>
</p>

---

## Why ANQL?

ANQL is built for **engineers**, **researchers**, **analysts** and **students** who want to write and calculate in the same place, without switching apps.

Write your notes and embed live calculations directly inside them. Define a variable, reuse it anywhere in the document. Your workspace *thinks* as you type — no context switching, no broken workflows.

---

## Features

### ✍️ Rich Text & Markdown Support

A fluid writing experience with intuitive formatting. Headings, lists, links, tables — everything you need for structured note-taking, without the bloat.

**Full Markdown Support**: Write seamlessly using standard Markdown shortcuts. Type `#` for headings, `-` for lists, `>` for blockquotes, or `$$` for math blocks. The editor transforms them instantly as you type.

### 🔢 Live Math — inline, in context

The heart of ANQL. Embed mathematical expressions directly in your notes and watch them compute in real time.

```
mass = 74               → 74
gravity = 9.81          → 9.81
force = mass * gravity  → 725.94
```

- **Variables with scope** — define once, reuse everywhere in the document
- **Real-time results** — updates as you type, no manual execution
- **Full math library** via mathjs: trigonometry, statistics, algebra, matrices, unit conversions, and more
- **Error feedback** — clear visual hints when something goes wrong

#### What's available in the Math Panel

| Category | Functions |
|---|---|
| Arithmetic | `+`, `-`, `*`, `/`, `^`, `sqrt`, `mod` |
| Trigonometry | `sin`, `cos`, `tan`, and inverses |
| Logarithms | `log`, `log2`, `log10`, `exp` |
| Statistics | `mean`, `median`, `std`, `variance`, `min`, `max`, `sum`, `prod` |
| Algebra | `derivative`, `simplify`, `factorial`, `fraction` |
| Matrices | `det`, `inv`, `transpose`, `dot`, `cross` |
| Constants | `π`, `e`, `∞`, `i`, `phi` |
| Units | angles, temperature, length, weight, and more |
| Random | `random()`, random selection |
| Geometry | `distance`, `intersect` |

### 🗄️ Data Management

Structure your knowledge with tables, smart document links, and a local SQLite database. Your data stays on your machine — always.

**Tables & Calculations**
- Create tables with multiple column types (text, number, checkbox, date)
- Reference table data directly in math expressions: `Table1.column[1]` or `Table1.column`
- Automatic cell references and column aggregations (sum, mean, etc.)
- Link between documents using `@node:id` syntax

**Local Database**
- SQLite-based storage for fast, reliable data persistence
- Full-text search across all documents
- Asset management for images and files

### 🌐 Offline First

No internet required. ANQL runs entirely on your device. Your notes are yours.

### 🌙 Light & Dark Mode

Comfortable in any environment, at any hour.

### 📁 Import / Export

Import Markdown and ANQL files. Export in ANQL format.

---

## Getting Started

### Download

ANQL is currently available for **macOS**.

👉 [Download the latest release (v0.2.0)](https://github.com/anqlproject/anql/releases/tag/0.2.0)

Once installed, open the [**Quick Start guide**](QuickStart.md) to learn the basics in a few minutes — smart block creation, live math, search, and more.

### Build from source

**Prerequisites**
- Node.js 18+ and npm
- Rust and Cargo (for Tauri)
- macOS 11+ (Big Sur) or later

```bash
# Clone the repository
git clone https://github.com/anqlproject/anql.git
cd anql

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

---

## Troubleshooting

**Common Issues**

- **Build fails**: Ensure Node.js 18+ and Rust are installed
- **Tauri dev crashes**: Try clearing the cache: `rm -rf src-tauri/target`
- **Math not evaluating**: Check that expressions are valid mathjs syntax
- **Tables not showing**: Ensure columns have the correct data type

For more help, check our [GitHub Issues](https://github.com/anqlproject/anql/issues) or join our [Discord](https://discord.gg/z5Jgg9m83).

---

## Technical Details

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri](https://tauri.app/) |
| UI | [React](https://react.dev/) |
| Editor engine | [Lexical](https://lexical.dev/) |
| Math engine | [mathjs](https://mathjs.org/) |

### Platform Support

| Platform | Status |
|---|---|
| macOS | ✅ Supported |
| Windows | 🚧 Coming soon |
| Linux | 🚧 Coming soon |

### Roadmap

We're actively building. Here's what's on the roadmap:

- 📊 **Plotting & graph generation** — visualize your data inline
- 🪟 **Windows & Linux support**
- 🔗 **More export formats**

---

## Community

Got feedback? Found a bug? Have an idea?

💬 [Join our Discord server](https://discord.gg/z5Jgg9m83) — we'd love to hear from you.

🐛 [Report a bug or request a feature](https://github.com/anqlproject/anql/issues)

 Follow us on [X / Twitter](https://x.com/anqlproject) for updates.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
