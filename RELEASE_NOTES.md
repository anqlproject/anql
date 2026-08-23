# ANQL v0.3.0 Release Notes

We're excited to announce v0.3.0 of ANQL, featuring major enhancements to the math system with table integration, improved markdown support, and comprehensive documentation!

## 🚀 What's New in v0.3.0

### 🧮 Advanced Math System with Table Integration
- **Table Variable System** - Reference table data directly in math expressions
  - Access entire columns as matrices: `Table1.column`
  - Reference specific cells: `Table1.column[1]`
  - Automatic column aggregations (sum, mean, etc.)
  - Table data included in math variable scope
- **Smart Math Autocomplete** - Context-aware suggestions as you type
  - Shows variables, table columns, and math functions
  - Filters table names from variable suggestions
  - Only appears when typing for cleaner UI
  - Fixed autoscroll issues in autocomplete menu
- **Enhanced Math Results Display**
  - Copy button in math result dialog for easy copying
  - Double-click to copy math results to clipboard
  - Improved result positioning that syncs with nodes
  - Migrated to React Portals and Floating UI for better performance
- **Better Error Handling** - Clear error messages for table-related math issues
- **Improved Variable UI** - Italic styling for variables in autocomplete and panel

### 📊 Table Improvements
- **Table Titles** - Add descriptive titles to your tables
  - Minimized when empty for cleaner UI
  - Placeholder and tooltip support
  - Improved number input UI and title alignment
- **Better Cell Interaction** - Ctrl+A now works properly in table cells
- **Enhanced Number Input** - Improved UI for number cells in tables

### 📝 Enhanced Markdown Support
- **Restructured Markdown Plugin** - Better organization and maintainability
- **Math Block Shortcuts** - Type `$$` for instant math block creation
- **Smart Backspace/Delete** - Convert math blocks to paragraphs when empty
- **Comprehensive Documentation** - Added markdown support documentation

### ⚙️ Settings & Theme System
- **Zustand Migration** - Replaced React Context with Zustand for better state management
- **Auto-Save Settings** - Settings save immediately on change (no save button needed)
- **Fixed Persistence** - Sidebar parameters now properly persist

### 🎨 UI/UX Improvements
- **Better Typography** - Improved spacing and visual consistency
- **Cleaner Math Panel** - Restyled variable UI for better readability
- **Global Search Enhancement** - Mark documents in trash during search
- **QuickStart Guide** - Added comprehensive QuickStart guide with GIF demos

### 📚 Documentation & Project
- **Code of Conduct** - Added Contributor Covenant 2.1 based Code of Conduct
- **Improved README** - Better structure with contributing guide, troubleshooting, and license section
- **Contributing Guidelines** - Enhanced with locale-specific guidelines
- **Project Metadata** - Setup open source guidelines and project structure

### 🔧 Code Quality & Refactoring
- **Math Plugin Restructuring** - Decomposed monolithic MathPlugin into specialized modules
- **Node Menu Cleanup** - Removed deprecated copy math result option
- **File Reorganization** - Improved code structure and maintainability
- **TypeScript Improvements** - Better type safety across components

### 🐛 Bug Fixes
- **Math Result Positioning** - Fixed sync issues between results and nodes
- **Autocomplete Filtering** - Better filtering of suggestions
- **Table Cell Selection** - Fixed Ctrl+A behavior in table inputs
- **Settings Persistence** - Fixed sidebar parameters not saving
- **Node Menu** - Removed deprecated copy math result feature

---

## 🔄 Upgrade Notes

### Breaking Changes
- None - This release maintains backward compatibility

### Migration Guide
- No migration required - all changes are backward compatible
- Table variable system is opt-in and works with existing math expressions

---

## 🙏 Thank You
