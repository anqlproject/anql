<p align="center">
  <img src="assets/logo_1024.png" alt="ANQL" height="80" />
</p>

<h1 align="center">ANQL — Quick Start</h1>

<p align="center">
  Everything you need to get productive in ANQL, fast.<br/>
  <a href="README.md">← Back to README</a>
</p>

---

## Getting started

ANQL is a fast, distraction-free workspace for your notes. Here's how to master the flow in just a few steps.

### 1. Create your first document

Click **New Document** in the sidebar or use the **⌘N** shortcut. Each document is stored locally on your machine — instantly accessible, with no account needed.

### 2. Write and format

Start typing. ANQL uses a fluid block-based editor. You can:

- Format text seamlessly with standard Markdown: `#` for headings, `-` for lists, `>` for blockquotes.
- Select any text to reveal the **floating toolbar** for quick formatting (bold, italic, links) without leaving the keyboard flow.
- Drag any block's handle to easily reorder your content.

### 3. Smart Creation

Don't waste time hunting for menus. On any **new empty line**, just start typing a keyword and press `TAB` or `↵` to instantly transform the block.

```
type "h2"    → TAB  ⇒  inserts a Heading 2
type "table" → TAB  ⇒  inserts a table
type "code"  → TAB  ⇒  inserts a code block
```

> See the [full keyword list](#smart-creation-keywords) at the bottom of this page.

### 4. Lightning Search

Never lose a thought.
- **Local search (`⌘ F`)**: Find text within the current document.
- **Global search (`⌘ G`)**: Search across your entire workspace instantly.

### 5. Transform a block

Changed your mind? Click a block's menu (or use the drag handle) and select **Transform** to switch a paragraph into a heading, or a list into a task list, without losing any content.

---

## 🪄 Discover Hidden Powers (Math & Variables)

ANQL is simple by design, but hides powerful tools for when you need them. 
If you ever need to calculate something while taking notes, you don't need to open a calculator app.

Just create a **Math block** (type `math` and press `TAB`), and try typing an expression:

```
speed = 100        → 100
time  = 2          → 2
dist  = speed * time  → 200
```

The results compute in real-time. Even better, variables are shared across all math blocks in the same document!

---

## Feature demos

<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>Category</th>
      <th align="center">Preview</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Create a new document</strong></td>
      <td>📝 Documents</td>
      <td align="center"><img src="assets/create new document.gif" alt="Create new document" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Local & Global search</strong></td>
      <td>🔍 Navigation</td>
      <td align="center"><img src="assets/global search.gif" alt="Search" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Smart creation (Heading)</strong></td>
      <td>➕ Editing</td>
      <td align="center"><img src="assets/smart creation heading.gif" alt="Creation heading" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Smart creation (Task list)</strong></td>
      <td>➕ Editing</td>
      <td align="center"><img src="assets/smart creation task.gif" alt="Creation task list" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Smart creation (Table)</strong></td>
      <td>➕ Editing</td>
      <td align="center"><img src="assets/smart creation table.gif" alt="Creation table" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Node transformation</strong></td>
      <td>🔄 Editing</td>
      <td align="center"><img src="assets/node transformation task.gif" alt="Node transformation" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Live Math (Hidden Feature)</strong></td>
      <td>🔢 Power Tools</td>
      <td align="center"><img src="assets/math panel.gif" alt="Math panel" width="360" /></td>
    </tr>
  </tbody>
</table>

---

## Smart Creation Keywords

> **Note:** Smart creation only works on a **new, empty node** (empty paragraph). Start typing one of the keywords below and press `TAB` or `↵` to instantly transform the block.

| Block type | Keywords |
|---|---|
| Heading 1 | `heading 1`, `h1` |
| Heading 2 | `heading 2`, `h2` |
| Heading 3 | `heading 3`, `h3` |
| Bullet list | `bullet list`, `list`, `unordered list` |
| Number list | `number list`, `ordered list` |
| Check list | `check list`, `todo`, `task` |
| Quote | `quote` |
| Code block | `code`, `script` |
| Table | `table` |
| Horizontal line | `line`, `separator` |
| Math block | `math`, `calculator` |
| Image | `image`, `photo`, `picture`, `img` |
| Help | `help`, `documentation`, `doc` |
