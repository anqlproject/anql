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

ANQL is a note-taking workspace where writing and calculating happen in the same place. Here's how to get up and running in a few steps.

### 1. Create your first document

Click **New Document** in sidebar or use **⌘N** shortcut. Each document is stored locally on your machine — no account needed.

### 2. Write and format

Start typing. ANQL uses a block-based editor: every paragraph, heading, list, or math expression is its own block. You can:

- Format text with **bold**, *italic*, `code`, and more
- Add headings, bullet lists, numbered lists, task lists, tables, and code blocks
- Drag any block to reorder it

### 3. Create blocks with Smart Creation

On any **new empty line**, start typing a keyword and press `TAB` or `↵` to instantly insert a block. No menus, no clicks.

```
type "math"  → TAB  ⇒  inserts a math block
type "table" → TAB  ⇒  inserts a table
type "h2"    → TAB  ⇒  inserts a Heading 2
```

> See the [full keyword list](#smart-creation-keywords) at the bottom of this page.

### 4. Do live math

In a **Math block**, type any expression and see the result instantly:

```
speed = 100        → 100
time  = 2          → 2
dist  = speed * time  → 200
```

Variables are shared across all math blocks in the same document. Define a value once and reuse it anywhere.

### 5. Transform a block

Want to change a paragraph into a heading? Or a list into a task list? Click the block menu (or use the drag handle) and select **Transform** to switch the block type without losing your content.

### 6. Search

| Scope | Shortcut | Description |
|---|---|---|
| Local search | `⌘ F` | Find text within the current document |
| Global search | `⌘ G` | Search across all your documents at once |

### 7. Format selected text

Select any text to reveal the **floating toolbar** — it appears automatically above your selection. From there you can apply bold, italic, underline, strikethrough, inline code, links, and more without ever leaving the keyboard flow.

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
      <td><strong>Create node button</strong></td>
      <td>📝 Documents</td>
      <td align="center"><img src="assets/create node button in action.gif" alt="Create node button" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Global search</strong></td>
      <td>🔍 Navigation</td>
      <td align="center"><img src="assets/global search.gif" alt="Global search" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Local search</strong></td>
      <td>🔍 Navigation</td>
      <td align="center"><img src="assets/local search.gif" alt="Local search" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Creation heading</strong></td>
      <td>➕ Smart Creation</td>
      <td align="center"><img src="assets/smart creation heading.gif" alt="Creation heading" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Creation code block</strong></td>
      <td>➕ Smart Creation</td>
      <td align="center"><img src="assets/smart creation code.gif" alt="Creation code block" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Creation table</strong></td>
      <td>➕ Smart Creation</td>
      <td align="center"><img src="assets/smart creation table.gif" alt="Creation table" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Creation task list</strong></td>
      <td>➕ Smart Creation</td>
      <td align="center"><img src="assets/smart creation task.gif" alt="Creation task list" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Creation math block</strong></td>
      <td>➕ Smart Creation</td>
      <td align="center"><img src="assets/smart creation math.gif" alt="Creation math block" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Math panel</strong></td>
      <td>🔢 Live Math</td>
      <td align="center"><img src="assets/math panel.gif" alt="Math panel" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Variables across blocks</strong></td>
      <td>🔢 Live Math</td>
      <td align="center"><img src="assets/math panel use variable.gif" alt="Math panel use variable" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Square root</strong></td>
      <td>🔢 Live Math</td>
      <td align="center"><img src="assets/sqrt demonstration.gif" alt="sqrt demonstration" width="360" /></td>
    </tr>
    <tr>
      <td><strong>Node transformation</strong></td>
      <td>🔄 Transformation</td>
      <td align="center"><img src="assets/node transformation task.gif" alt="Node transformation" width="360" /></td>
    </tr>
  </tbody>
</table>

---

## Smart Creation Keywords

> **Note:** Smart creation only works on a **new, empty node** (empty paragraph). Start typing one of the keywords below and press `TAB` or `↵` to instantly transform the block.

| Block type | Keywords |
|---|---|
| Code block | `code`, `script` |
| Horizontal line | `line`, `separator` |
| Image | `image`, `photo`, `picture`, `img` |
| Table | `table` |
| Heading 1 | `heading 1`, `h1` |
| Heading 2 | `heading 2`, `h2` |
| Heading 3 | `heading 3`, `h3` |
| Number list | `number list`, `ordered list` |
| Bullet list | `bullet list`, `list`, `unordered list` |
| Check list | `check list`, `todo`, `task` |
| Quote | `quote` |
| Math block | `math`, `conversion`, `calculator` |
| Help | `help`, `documentation`, `doc` |
