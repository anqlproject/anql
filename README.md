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
  <a href="#tech-stack">Tech Stack</a> |
  <a href="#community">Community</a>
</p>

<br />

![ANQL Overview](assets/overview.png)

<p align="center">
  <img src="assets/overview 1.png" alt="ANQL Overview 1" width="45%" />
  <img src="assets/overview 2.png" alt="ANQL Overview 2" width="45%" />
</p>

---

## Why ANQL?

ANQL is built for **engineers**, **researchers**, **analysts** and **students** who want to write and calculate in the same place, without switching apps.

Write your notes and embed live calculations directly inside them. Define a variable, reuse it anywhere in the document. Your workspace *thinks* as you type — no context switching, no broken workflows.

---

## Features

### ✍️ Rich Text — the way you expect it

A fluid writing experience with intuitive formatting. Headings, lists, links, tables — everything you need for structured note-taking, without the bloat.

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

### Build from source

```bash
# Clone the repository
git clone https://github.com/anqlproject/anql.git
cd anql

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

---

## What's Coming Next

We're actively building. Here's what's on the roadmap:

- 📊 **Plotting & graph generation** — visualize your data inline
- 🪟 **Windows & Linux support**
- 🔗 **More export formats**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri](https://tauri.app/) |
| UI | [React](https://react.dev/) |
| Editor engine | [Lexical](https://lexical.dev/) |
| Math engine | [mathjs](https://mathjs.org/) |

---

## Platform Support

| Platform | Status |
|---|---|
| macOS | ✅ Supported |
| Windows | 🚧 Coming soon |
| Linux | 🚧 Coming soon |

---

## Community

Got feedback? Found a bug? Have an idea?

💬 [Join our Discord server](https://discord.gg/z5Jgg9m83) — we'd love to hear from you.

🐦 Follow us on [X / Twitter](https://x.com/anqlproject) for updates.
