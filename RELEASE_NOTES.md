# Release Notes

## Version 0.5.0

Version 0.5.0 introduces ANQL's reference system for creating, organizing, and reusing content across documents, alongside a range of bug fixes and improvements throughout the app.

### Features

- **References**
  - Create and reuse references for text, LaTeX formulas, constants, code blocks, images, and PDFs.
  - Track reference usage across your documents with an interactive usage panel and direct block navigation.
  - Browse and search online libraries with nested folders, verified code, and formula packages.
  - Drag and drop online or local resources directly into the document editor or table cells to insert them immediately.
  - Manage references with deletion confirmations, group tabs, and a dedicated trash bin with restore support.
- **Math & equation tooltips:**
  - View variable values and details by hovering directly over variables in math expressions.
  - Display linked reference names on hover over referenced LaTeX equations.
- **Home document search:** Filter and find documents by name in real time from the Home screen.
- **Document details:** Inspect document word counts, creation and modification dates, and save status directly from the title bar.
- **Trash filtering:** Filter deleted items by category between documents and references.
- **Redesigned settings:** Refined settings panel with custom dropdown menus and a tabbed theme selector.
- **Refined typography:** Adopted Inter as the default sans-serif font alongside an updated, polished typographic scale.
- **Empty-state onboarding:** Modernized empty document view with streamlined quick actions to start writing or inserting blocks.

### Fixes

- **Math & calculations:**
  - Restrict variable hover tooltips strictly to text bounds to avoid accidental triggers outside formulas.
  - Fix inconsistent hover highlights in math autocomplete with a unified neutral state.
- **Editor & blocks:**
  - Preserve completed checklist items when splitting a list at the start of an item.
  - Synchronize draggable block handle positions on node deletion, transformation, and resize.
  - Fix image distortion by strictly preserving natural aspect ratios when rendering in the editor.
- **Tables & scrolling:**
  - Lower the table horizontal scrollbar position to prevent overlapping cell content and add indicators.
  - Refine scrollbar track sizing and clipping across panels.
- **Documents & search:**
  - Preserve document metadata (word count, dates, settings) when duplicating documents.
  - Prevent accidental duplicate document creation when cloning.
  - Improve local search bar contrast and visibility; disable navigation buttons when no matches are found.
- **Interface & window:**
  - Prevent double-clicking the sidebar trigger button from inadvertently maximizing the window.
  - Remove unintended hover backgrounds on static setting rows.
  - Enable text selection inside help cards and documentation dialogs.
  - Remove unwanted entrance animations on the title bar document info button.
  - Keep trash filter tabs fixed and visible at the top while scrolling through deleted items.
  - Normalize sidebar icon hover colors and improve recent document list contrast.
- **Storage & packaging:**
  - Prevent deletion of media assets that are still referenced or used by existing documents.
  - Fix missing `.DirIcon` and application icons in Linux AppImage desktop packages.

***

*Made with ❤️*
