### 🎨 `styles.css` (UI Stylesheet & Theme System)

`styles.css` provides a lightweight, pure CSS design system for AU Launchpad, eliminating external dependencies while maintaining native dark mode support and responsive layout rules.

#### Key Design System Details
- **CSS Custom Properties & Dark Mode**:
  - Custom variables (`--bg`, `--card`, `--accent`, `--line`, etc.) handle light and dark mode switching automatically via standard `@media (prefers-color-scheme: dark)` queries.
  - Uses `#c8191f` as the primary brand accent red color.
- **Responsive Layout Grids**:
  - Custom grid utilities (`.g2`, `.g3`, `.g4`, `.g-side`) automatically collapse to single-column layouts on screens narrower than `860px`.
  - Navigation switches from a fixed left sidebar rail to a touch-scrollable horizontal menu on mobile devices.
- **Print Optimization**:
  - Dedicated `@media print` rules hide background layout elements and display `#print-root` exclusively for clean paper and PDF output.
- **Custom Form UI Controls**:
  - Fully styled custom toggle switches (`.perm-grid input[type=checkbox]`) for security and administrative permission management panels.

---