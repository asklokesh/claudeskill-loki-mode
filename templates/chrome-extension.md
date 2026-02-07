# PRD: Chrome Tab Manager Extension

## Overview
A Chrome browser extension called "TabFlow" that helps users manage, organize, and save groups of browser tabs. Built with Manifest V3, it provides tab grouping, session saving, search, and memory usage insights.

## Target Users
- Knowledge workers with 20+ tabs open regularly
- Researchers managing multiple projects simultaneously
- Developers switching between different work contexts
- Anyone who wants to reduce browser tab clutter

## Features

### MVP Features
1. **Tab Overview** - Popup showing all open tabs across windows, grouped by domain
2. **Tab Groups** - Create named groups, drag tabs between groups, color-code groups
3. **Save Sessions** - Save all current tabs as a named session, restore later
4. **Tab Search** - Fuzzy search across all open tabs by title or URL
5. **Suspend Tabs** - Suspend inactive tabs to free memory (replace with placeholder)
6. **Duplicate Detection** - Highlight and optionally close duplicate tabs
7. **Quick Actions** - Close all tabs from a domain, close tabs older than X hours
8. **Memory Monitor** - Show per-tab memory usage, highlight heavy tabs

### User Flow
1. User clicks extension icon -> popup shows tab overview
2. Tabs are grouped by domain with tab count per domain
3. User can search tabs, click to switch, or right-click for actions
4. User creates a named session "Research Project" -> saves 15 tabs
5. Closes all those tabs -> later restores session with one click
6. Memory monitor shows which tabs use the most RAM
7. Duplicate detector finds 3 duplicates -> user closes them

## Tech Stack
- Platform: Chrome Extension (Manifest V3)
- Popup UI: HTML + CSS + vanilla JavaScript (no framework, fast load)
- Background: Service Worker (Manifest V3 requirement)
- Storage: chrome.storage.local for sessions, chrome.storage.sync for settings
- Icons: Lucide icons (SVG)
- Build: esbuild for bundling service worker

### Structure
```
/
├── manifest.json
├── src/
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   ├── popup.js           # Main popup logic
│   │   ├── components/
│   │   │   ├── tab-list.js    # Tab list rendering
│   │   │   ├── search.js      # Fuzzy search
│   │   │   ├── groups.js      # Tab group management
│   │   │   ├── sessions.js    # Session save/restore UI
│   │   │   └── memory.js      # Memory usage display
│   │   └── utils/
│   │       ├── dom.js         # DOM helpers
│   │       └── format.js      # Size/time formatting
│   ├── background/
│   │   ├── service-worker.js  # Background service worker
│   │   ├── tab-manager.js     # Tab tracking logic
│   │   ├── session-store.js   # Session persistence
│   │   ├── duplicate.js       # Duplicate detection
│   │   └── suspend.js         # Tab suspension logic
│   ├── content/
│   │   └── suspended.html     # Suspended tab placeholder page
│   └── options/
│       ├── options.html       # Settings page
│       ├── options.css
│       └── options.js
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── tests/
│   ├── tab-manager.test.js
│   ├── duplicate.test.js
│   ├── session-store.test.js
│   └── search.test.js
├── package.json
└── README.md
```

## Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "TabFlow - Tab Manager",
  "version": "1.0.0",
  "description": "Organize, save, and manage browser tabs efficiently",
  "permissions": [
    "tabs",
    "tabGroups",
    "storage",
    "activeTab",
    "system.memory"
  ],
  "optional_permissions": [
    "processes"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_page": "src/options/options.html",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

## Storage Schema

### chrome.storage.local (Sessions)
```json
{
  "sessions": [
    {
      "id": "uuid-string",
      "name": "Research Project",
      "createdAt": "2025-01-15T10:30:00Z",
      "tabs": [
        {
          "url": "https://example.com",
          "title": "Example Page",
          "favIconUrl": "https://example.com/favicon.ico"
        }
      ]
    }
  ]
}
```

### chrome.storage.sync (Settings)
```json
{
  "settings": {
    "groupByDomain": true,
    "showMemoryUsage": true,
    "autoSuspendMinutes": 30,
    "suspendPinned": false,
    "duplicateAction": "highlight",
    "theme": "system",
    "maxSessionCount": 50,
    "sortOrder": "domain"
  }
}
```

## API (Chrome Extension APIs Used)

### Tabs
- `chrome.tabs.query()` - Get all open tabs
- `chrome.tabs.update()` - Switch to a tab
- `chrome.tabs.remove()` - Close tabs
- `chrome.tabs.create()` - Open new tab (session restore)
- `chrome.tabs.group()` - Add tabs to a group
- `chrome.tabs.ungroup()` - Remove from group
- `chrome.tabs.discard()` - Discard tab to save memory

### Tab Groups
- `chrome.tabGroups.update()` - Set group title and color
- `chrome.tabGroups.query()` - Get existing groups

### Storage
- `chrome.storage.local.get/set` - Sessions data (larger storage)
- `chrome.storage.sync.get/set` - Settings (synced across devices)

### Events
- `chrome.tabs.onCreated` - Track new tabs
- `chrome.tabs.onRemoved` - Track closed tabs
- `chrome.tabs.onUpdated` - Track URL/title changes
- `chrome.runtime.onInstalled` - First install setup

## Requirements
- Manifest V3 compliance (service worker, no persistent background)
- Popup loads in under 200ms (even with 100+ tabs)
- Session data persists across browser restarts
- Settings sync across Chrome profiles
- Keyboard shortcuts: Ctrl+Shift+F to open search, Ctrl+Shift+S to save session
- Accessible: proper ARIA labels, keyboard navigation in popup
- Responsive popup width: 400px default, expandable to 600px
- Dark mode support (follows Chrome theme or system preference)
- No external network requests (fully offline capable)

## Testing
- Unit tests: Tab grouping logic, duplicate detection, fuzzy search, format utilities (Vitest)
- Integration tests: Session save/restore with mocked chrome.storage API
- Manual testing: Load as unpacked extension, test with 50+ tabs
- Edge cases: Incognito tabs (excluded), pinned tabs, chrome:// URLs (not accessible)

## Out of Scope
- Firefox or Safari support
- Tab sharing between users
- Cloud sync of sessions (beyond Chrome sync)
- Tab screenshots/thumbnails
- History analysis or analytics
- Chrome Web Store publishing
- Cross-browser extension framework (WebExtension polyfill)

## Success Criteria
- Extension installs and popup opens correctly
- All open tabs displayed and searchable in under 200ms
- Tab groups can be created, named, and color-coded
- Sessions save and restore correctly (all tabs, correct URLs)
- Duplicate tabs detected and highlighted
- Tab suspension frees memory and shows placeholder
- Memory usage displayed per tab (where API allows)
- Settings persist and sync across devices
- All tests pass

---

**Purpose:** Tests Loki Mode's ability to build a browser extension with Chrome APIs, background service workers, local storage, and a responsive popup UI. Expect ~30-45 minutes for full execution.
