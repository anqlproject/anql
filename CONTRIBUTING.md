# Contributing to ANQL

Thank you for your interest in the ANQL project! All contributions (bug fixes, new features, documentation) are welcome.

This document explains how to set up the project locally, our coding standards, and how to propose your changes.

---

## 🛠 Prerequisites

Before getting started, make sure you have the following tools installed on your machine:
- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[Git](https://git-scm.com/)**
- *If you are working on the Desktop (Tauri) part*: **[Rust and Cargo](https://rustup.rs/)**, as well as the system dependencies required by [Tauri](https://tauri.app/v1/guides/getting-started/prerequisites/).

## 🚀 Local Installation

1. **Fork** the repository to your own GitHub account.
2. **Clone** your fork to your local machine:
   ```bash
   git clone https://github.com/anqlproject/anql.git
   cd anql
   
   # Add the upstream remote to keep your fork synced
   git remote add upstream https://github.com/anqlproject/anql.git
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

## 📁 Project Structure

ANQL is built with React, Lexical, and Tauri.
- `/src`: Contains the React/Vite frontend code, including the Lexical editor plugins and UI components.
- `/src-tauri`: Contains the Rust backend for the desktop application.
- `/docs`: Project documentation.

## 💻 Available npm Scripts

Here are the main commands you will use during development:

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

## 🎨 Editor Configuration

- **Prettier - Code formatter** (`esbenp.prettier-vscode`)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **rust-analyzer** (`rust-lang.rust-analyzer`) - *for Tauri development*
- **Tauri** (`tauri-apps.tauri-vscode`)

Please ensure your editor is configured to **Format on Save**.

## 🔄 Branching Strategy

- `main` is our primary branch. It should always be stable and deployable.
- Always create a new branch from `main` for your work: `feature/your-feature-name` or `fix/your-bug-fix`.

## ✍️ Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Your commit messages should be structured as follows:

```
<type>(<optional scope>): <description>
```

**Common types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `chore`: Changes to the build process or auxiliary tools and libraries
- `locales`: Changes to translation files and locale-specific content

*Example:* `feat(editor): add math plugin support`

## 🤝 How to Submit a Pull Request (PR)

1. **Create your branch**: `git checkout -b feature/my-feature`
2. **Make your changes**.
3. **Run tests and linters** to ensure everything is correct:
   ```bash
   npm run lint
   npm run test
   ```
4. **Commit your changes** following the conventions above.
5. **Push to your fork**: `git push origin feature/my-feature`
6. Open a **Pull Request** against the `main` branch of the `anqlproject/anql` repository.
7. Fill out the PR template completely and describe your changes clearly.

## 🐛 Reporting Bugs and Asking Questions

- **Bugs**: If you find a bug, please check if it has already been reported in the [Issues](https://github.com/anqlproject/anql/issues) tab. If not, open a new issue with a clear description and steps to reproduce.
- **Questions/Discussions**: Feel free to open a Discussion on GitHub if you need help or want to propose an idea.

## 📜 Code of Conduct & License

By participating in this project, you agree to abide by our Code of Conduct (if applicable).
ANQL is released under the **MIT License**.

---
Thank you for helping make ANQL better! 🎉
