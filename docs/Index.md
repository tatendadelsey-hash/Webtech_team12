### 📄 `index.html` (Application Shell & Entry Point)

`index.html` acts as the root entry point for the **AU Launchpad** single-page application (SPA). It uses plain HTML5 and standard ES JavaScript without requiring any build step or bundler.

#### Key Features & Architecture
- **Single-Page Framework Container**:
  - `#app`: Serves as the primary rendering target for dynamic view routing.
  - `#modal-root`: Designated container for modal dialog overlays.
  - `#toasts`: Live region (`aria-live="polite"`) for floating notifications.
  - `#print-root`: Isolated container used for clean DOM rendering during document printing.
- **No-Build Script Ordering**:
  - Scripts are executed synchronously in exact dependency order:
    1. Configuration & Initial Mock Data (`config.js`, `data.js`)
    2. State & UI Helpers (`store.js`, `ui.js`)
    3. Role Views (`shell.js`, `student.js`, `staff.js`, `supervisor.js`, `admin.js`)
    4. Main Application Entry (`app.js`)
- **Demo Control Bar**:
  - Features an embedded button to trigger standard demo data resets (`data-act="resetDemo"`).

---