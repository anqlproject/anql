# 🎉 Release Notes - Version 0.4.0

This major update brings a wealth of new features, including a brand-new chart integration, a massive overhaul of the table node, advanced math calculations, and significant UI improvements with the adoption of native system menus.

### ✨ New Features

*   **📊 Chart Integration:**
    *   Generate charts directly from your table data.
    *   Advanced chart configuration: axis selection, color palette customization, and series isolation tabs.
    *   Dynamic chart type proposals tailored to each table's content.
    *   Markdown import/export support for charts via the `@chart` syntax.
*   **📐 Table Overhaul:**
    *   **Inline Editing:** Cells now display cleanly and switch to edit mode on click.
    *   **Data Types:** Introduced column data typing (`ColumnDataType`).
    *   **Improved Ergonomics:** Smooth slide-in animations for quick-add strips (rows/columns), revamped drag-and-drop handles, and better vertical column resizing.
    *   Added Zebra striping for better row readability.
*   **🧮 Math & Calculations:**
    *   Support for **inline math calculations**.
    *   Support for **user-defined functions** and **units** in variable assignments.
    *   Table column operations are now directly accessible from the math button (column statistics, cell references).
*   **🧩 Default Templates:** 
    *   Automatic injection of default templates (like a math demonstration document) on first launch.
*   **🔄 Automatic Updates:** 
    *   Integrated Tauri Updater to receive future versions directly within the app.
*   **🖥️ Cross-Platform Desktop Support:**
    *   ANQL is now available for Windows and Linux, alongside macOS.

### 💅 UI & UX Improvements

*   **🖥️ Native Menus:** Transitioned the Document Menu, Context Menu, Node Menu, and Footer Menu to use native macOS/Tauri system menus for a more polished and native feel.
*   **⌨️ Shortcuts:** Added `Cmd+,` keyboard shortcut to open the settings overlay.
*   **🖌️ Styling & Animations:**
    *   Improved overall typography and editor theme consistency.
    *   Refined sidebar interactions, highlights, and theme colors.
    *   Added animations for the toolbar's horizontal collapse and table add buttons.
    *   Made the horizontal table scrollbar thinner and less intrusive.
    *   Action menus for code blocks now appear only on hover.

### 🐛 Bug Fixes & Stability

*   **Editor & Core Interactions:**
    *   Fixed a major issue where the `Space` key stopped working when popovers were open.
    *   Prevented scrolling while overlays, context menus, and custom menus are open.
    *   Fixed incorrect block positions in the database after drag-and-drop operations.
    *   Fixed macOS autoscroll functionality when dragging blocks.
    *   Resolved list copy-paste errors and selection gaps.
    *   Addressed multiple bugs regarding menu overlaps (e.g., hiding the floating toolbar when the context menu is open).
    *   Fixed the block formatting state and quote block transformation inside the node menu.
    *   Fixed a bug preventing the first node replacement when pressing `Enter` in the title.
    *   Properly toggled read/write modes in the document menu.
*   **Tables:**
    *   Stabilized HTML export, row IDs generation, and cell sizing.
    *   Preserved cell text color and placed the caret at the end of cell content properly.
    *   Fixed row/column menu toggling, drag handle layering, and drag states remaining after copying a row link.
    *   Fixed context menus appearing when a cell was not explicitly selected.
    *   Fixed highlight selections not appearing on right-click within a cell.
    *   Resolved an `InvalidStateError` regarding number input selections in cells.
*   **Charts & Math:**
    *   Prevented unnecessary re-renders for chart and math nodes.
    *   Fixed syncing issues with curve colors and the y-axis menu.
    *   Stabilized chart configuration normalization and debounced database writes.
    *   Ensured only numeric table columns are exposed for math calculations.
    *   Aligned table variables with proper scope principles and respected scope ordering for math autocomplete variables.
    *   Resolved `setState()` errors during render cycles for math autocomplete menus.
    *   Prevented autocomplete activation inside nodes containing links.
*   **Search & Highlighting:**
    *   Preserved local search highlights while actively editing text.
    *   Cleaned up search highlights appropriately when the search field is closed.
    *   Fixed local search autofocus issues and UI shifting after autoscrolling.
    *   Resolved highlight mismatches when searching across multiple tables.
*   **Images & Media:**
    *   Prevented image layout shifts during lazy loading and document initialization.
    *   Improved image resizing, scrolling, and wrapping behaviors.
*   **Build & System:**
    *   Stabilized database initialization and template loading.
    *   Resolved docs JSON imports in TypeScript and removed deprecated `baseUrl` usage.

***

*Made with ❤️*
