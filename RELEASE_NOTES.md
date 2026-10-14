# Release Notes

## Version 0.4.2

This release introduces CSV import and export for tables, several editor and interface refinements, and fixes across tables, the Home screen, and the clipboard.

### Features

- Import a CSV file directly into the editor as a table — the filename becomes the table name automatically.
- Export any table to CSV from its node menu, with the table name pre-filled as the default filename.

### Interface Improvements

- Add a subtle gradient pill indicator at the bottom of tables to mark their boundary.
- Animate the draggable block handle and drop indicator in the editor.
- Animate toolbar hover states with consistent sizing.
- Redesign the Home sort dropdown to a compact icon-only button with a refined active state.
- Add smooth scale-in and fade-in animation to the component dialog.
- Apply smooth animation to Home card checkboxes.
- Display the installed app version in the About panel.
- Select all or deselect all documents at once in Home selection mode.

### Fixes And Maintenance

- Preserve table rows and detect column headers correctly when pasting.
- Preserve rich HTML content when pasting Markdown into the editor.
- Paste clipboard content as plain text in the document title.
- Fix row menu popover collision avoidance.
- Fix Home selection checkbox position in list view.
- Hide the Home read-mode badge to prevent overlap with the card menu.
- Fix Home checkbox visibility after mouse focus leaves.
- Fix bulk action alignment in Home document selection.
- Group background database maintenance tasks to prevent SQLite concurrency errors.
- Remove noisy toast on intermittent DB integrity check failure.
- Avoid unnecessary re-renders in math result display.
- Fix search result scrolling to wait for Lexical DOM commit.
- Use native check item for read mode and theme selection in menus.

***

*Made with ❤️*
