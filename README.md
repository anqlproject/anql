<p align="center">
  <img src="assets/logo_1024.png" alt="ANQL" height="120" />
</p>

<h1 align="center">ANQL</h1>

<p align="center">
  <strong>A fast and minimalist workspace.</strong>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.3.1-blue" style="pointer-events: none;" />
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

![ANQL main interface showing document editor](assets/overview.png)

---

## See it in action

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Create seamlessly</strong><br/><br/>
      <img src="assets/create new document.gif" alt="Create new document" />
    </td>
    <td align="center" width="50%">
      <strong>Smart block creation</strong><br/><br/>
      <img src="assets/smart creation heading.gif" alt="Smart creation" />
    </td>
  </tr>
</table>

<p align="center">
  <a href="QuickStart.md">→ See full Quick Start guide</a>
</p>

---

## Why ANQL?

ANQL is built to solve a specific problem: **working and organizing at the same time**, without friction. 

It looks like a simple notepad to keep you focused. But when you need to calculate numbers or build tables, powerful tools appear instantly (just try to type `math` and press `TAB`).

You get the simplicity of a distraction-free notepad, with the power of a complete workspace available precisely when you need it. 

---

## Features

### ✍️ Fluid Writing Experience
Write without friction. ANQL combines the simplicity of plain text with powerful formatting.
- **Markdown Friendly**: Use familiar shortcuts like `#` for headings or `-` for lists.
- **Smart Creation**: Type "table" or "h2" on a new line and press `TAB` to create it instantly.
- **Quick Formatting**: Select any text to style it without reaching for complicated menus.

### 🗄️ Local & Private (Offline-First)
Your data stays on your machine — always. No internet required.
- **Local SQLite Database**: Lightning-fast, reliable data persistence.
- **Full-text search**: Instantly find any thought across all your documents.
- **Asset management**: Easily embed images and files that are safely stored locally.

### ⚡️ Lightning Fast
Built with Tauri and React, ANQL is designed to be lightweight, responsive, and incredibly fast to launch and navigate.

### 🌙 Light & Dark Mode
Carefully crafted themes to keep you comfortable in any environment, at any hour.



---

## Getting Started

### Download

ANQL is currently available for **macOS**.

👉 [Download the latest release (v0.3.1)](https://github.com/anqlproject/anql/releases/tag/0.3.1)

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

- 🪟 **Windows & Linux support**
- 🔗 **More export formats**
- 📊 **Advanced visualizations**

---

## Community

Got feedback? Found a bug? Have an idea?

💬 [Join our Discord server](https://discord.gg/z5Jgg9m83) — we'd love to hear from you.

🐛 [Report a bug or request a feature](https://github.com/anqlproject/anql/issues)

 Follow us on [X / Twitter](https://x.com/anqlproject) for updates.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
