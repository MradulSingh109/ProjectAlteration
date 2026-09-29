# NWIS Frontend - Progress Tracking

This document tracks the progress of the Near-Wellbore Information System (NWIS) frontend project. It is intended to help other AI models or developers understand what has been built so far and resume work smoothly.

## Current State

We have completed **Step 3: Home Screen (Control Room Dashboard)** of the project plan. The application is built using React, Vite, Tailwind CSS, and React Router.

### Architectural Setup
*   **Theme & Design System:** Implemented according to `Design.md`. We are using a dark, warm charcoal theme (not pure black) with specific colors: `background`, `panel`, `line`, `foreground`, `dim`, `danger`, `caution`, and `normal`. The font used is IBM Plex Sans. No gradients or glassmorphism are used.
*   **Data Strategy:** Currently using synthetic mock data located in `src/data/` (wells, alerts, realtime, risk, nearby, events, documents). API wrapper functions in `src/api/` simulate network requests with a slight delay.

### Completed Components & Pages

1.  **Global Layout (`src/components/ui/Layout.jsx`)**
    *   Designed as a professional industrial control room interface.
    *   Features a compact, vertical icon-based sidebar on the left for navigation (Dashboard, Wells, Events, Documents).
    *   The layout is configured to allow scrolling on smaller viewports while maintaining the complex dashboard structure.

2.  **Home Screen / Well Map (`src/pages/WellMap.jsx`)**
    *   The main control room dashboard layout, divided into three main sections: Left Panel, Center (Map & Charts), and Right Panel.
    *   **Left Panel (Telemetry & Control):**
        *   Search bar (`⌘K` shortcut display).
        *   Active target metadata (Upper Assam, Duliajan Field, Well Name, Estimated Reserve, Daily Production).
        *   `RigInfoCard.jsx`: Displays a custom SVG illustration of a land drilling rig, showing Max Depth and Load Capacity.
        *   `KpiTiles.jsx`: A 2x2 grid showing Rig Availability, Water Usage, Cost per Barrel, and Mud Weight (fetching live data if available).
    *   **Center Panel (Geospatial & Telemetry):**
        *   `MapCanvas.jsx`: Uses `react-leaflet` to render a topographic/terrain map with a custom grayscale CSS filter (`.map-tiles-grayscale` in `index.css`) to match the reference design. Shows a pulsing active well marker, offset wells, a radius circle, and a bounding box.
        *   `DrillingChart.jsx`: A custom SVG-based bar and line chart mimicking the reference design, showing ROP (Rate of Penetration) and Torque over time.
        *   `PipelineTemp.jsx`: A compact SVG heat-strip showing pipeline temperature gradients (Normal, Warm, Hot).
    *   **Right Panel (Integrity & Alerts):**
        *   `IntegrityStatus.jsx`: Contains a custom SVG stacked bar chart showing hourly well integrity status (Normal, Warning, Critical).
        *   Includes a textual summary of stability and a list of active critical risk alerts.
        *   `NearbyWellsList.jsx`: Lists nearby offset wells with selectable checkboxes (max 3). Triggers the comparison panel.
        *   `WellComparisonPanel.jsx`: A slide-over panel comparing the active well with selected offset wells across formations, distance, similarity, and event stats (derived dynamically from `events.json`).

### CSS & Styling (`src/index.css`)
*   Added custom Tailwind theme extensions in `index.css`.
*   Implemented custom scrollbar styling for panels.
*   Added Leaflet map overrides (popup styling, zoom controls, tooltips).
*   Added animations for the active well pulse and high-risk alert borders.
*   Added the grayscale filter for topographic map tiles.

4.  **Well Details (`src/pages/WellDetails.jsx`)**
    *   Deep-dive screen for a single well, showing stratigraphy and historical context.
    *   **Left Panel:** Well profile (name, field, formation) and a list of offset wells allowing quick switching of the active context.
    *   **Center Panel:** `DepthTrack.jsx`, a highly advanced SVG component that renders a 3-column stratigraphic track.
        *   **Ruler**: Major and minor ticks dynamically scaled to the well's depth.
        *   **Lithology**: Groups event formations into contiguous zones, applying derived repeating pattern fills (sand, clay, shale) and vertical text.
        *   **Curves & Events**: Plots synthetic jagged-line curves for ROP and Torque, a prominent glowing "CURRENT DEPTH" indicator, and plots historical events with leader lines and an anti-collision vertical stagger algorithm to ensure labels don't overlap. Features interactive click-to-select.
    *   **Right Panel:** Event detail panel displaying the type, depth, severity, and evidence (document metadata and extraction note) for the selected event from the depth track.

5.  **Event Explorer (`src/pages/EventExplorer.jsx`)** ✅ Step 5 complete
    *   Three-panel control-room layout matching WellMap and WellDetails.
    *   **Left Panel:** Live event count, search box (same magnifier + ⌘K badge as WellMap), event-type checkboxes with severity-colored dots, severity checkboxes, formation dropdown, depth range inputs, "Clear all filters" link.
    *   **Center Panel:** Compact sortable table (Well, Type, Depth right-aligned monospace, Formation, Severity dot+label). Depth and Severity headers are clickable for asc/desc sort. Row hover + click-to-select. Empty state plain text.
    *   **Right Panel:** Uses shared `src/components/events/EventDetailCard.jsx` — identical markup to WellDetails' event panel. Includes "View on well's depth track" link that navigates to `/wells?id=...&event=...`.
    *   **Shared component:** `src/components/events/EventDetailCard.jsx` — now used by both EventExplorer and WellDetails so one edit keeps both in sync.
    *   **WellDetails update:** Now accepts `?event=<event_id>` query param and auto-selects the matching event on load, enabling deep-link from EventExplorer.

6.  **Documents (`src/pages/Documents.jsx`)** ✅ Step 6 complete — **All required prototype screens done**
    *   Two-panel layout (no right panel needed, per spec).
    *   **Left Panel:** Drag-and-drop zone (dashed border, drag-active state, file input behind it). Accepts `.pdf` only. Displays supported types (WCR, DDR) and demo pipeline note.
    *   **Center Panel:** Document table — Filename, Type, Well, Status, Events Extracted. Status shown as dot + label (same `SeverityDot` pattern as Event Explorer). In-progress dots (`ocr`, `extracting`) animate with Tailwind `animate-pulse`. Failed rows show "Retry" text link that resets and re-runs progression. Indexed rows with events > 0 show "N events extracted → view in Event Explorer" link that navigates to `/events?well=<well_id>`.
    *   **Simulated pipeline:** uploading a file adds it at "uploaded" then auto-progresses through `ocr → extracting → indexed` at 2s per stage with a random `events_extracted` of 2–9. Comment: `// simulated pipeline progression, replaced by real status polling once backend is ready`.
    *   **EventExplorer update:** now reads `?well=` query param on mount and pre-applies it as a `wellIdFilter`. A dismissible chip shows the active well filter. `clearFilters` resets it.

## Prototype Completion Status

All **6 required prototype screens** from `NWIS_PLAN.md` are now complete:
1. ✅ Home Screen / Well Map (WellMap.jsx)
2. ✅ Global Layout & Icon Sidebar (Layout.jsx)
3. ✅ Control Room Dashboard panels (Step 3: KpiTiles, RigInfoCard, DrillingChart, PipelineTemp, IntegrityStatus, MapCanvas)
4. ✅ Well Details & Depth Track (WellDetails.jsx, DepthTrack.jsx)
5. ✅ Event Explorer (EventExplorer.jsx, EventDetailCard.jsx)
6. ✅ Documents (Documents.jsx)
7. ✅ **Final Polish Pass Complete**: Audited all interactive elements. Disabled un-implementable UI elements (Menu, Settings, "More Action", Chart Expand). Wired WellMap search to filter nearby wells. Wired Dashboard Alerts to deep-link to WellDetails. Checked cross-links.
8. ✅ **Well Comparison Feature (WellMap)**: `NearbyWellsList.jsx` adds checkboxes (max 3) on the WellMap right panel. `WellComparisonPanel.jsx` is a slide-over showing active well + selected offset wells side-by-side with formation match highlighting, event stats, severity dots, and deepest event depth. `getWellComparisonStats()` added to wells.api.js.
9. ✅ **Depth Track Comparison (WellDetails)**: Checkboxes on each offset well in the left panel; checking one fetches its events and renders a side-by-side `DepthTrack` column in the center panel. Multiple wells can be compared simultaneously with horizontal scroll. Each compared track has a "Close ×" button.
10. ✅ **Light/Dark Theme Toggle**: Full theme system implemented without breaking visual identity.
    *   **Foundation**: Two CSS token sets (`[data-theme="dark"]` and `[data-theme="light"]`) in `index.css`. Tailwind `@theme` reads from these CSS vars so all Tailwind utility classes (`bg-background`, `text-foreground`, etc.) automatically respond.
    *   **Persistence**: `src/hooks/useTheme.js` — reads `localStorage["nwis-theme"]` → OS `prefers-color-scheme` → default dark. FOUT prevented by a sync script in `main.jsx` that sets `data-theme` before React renders.
    *   **Toggle control**: Sun/moon icon button at the bottom of Layout's sidebar (no new page section). Switches instantly without refresh.
    *   **SVG audit**: All hardcoded hex colors replaced with `var(--token)` in: `DrillingChart`, `RigInfoCard`, `DepthTrack` (lithology patterns, event markers, current-depth glow), `IntegrityStatus` (bars + grid lines), `PipelineTemp` (temperature color function), `EventExplorer` (severity/type dots), `Documents` (status dots).
    *   **Leaflet exception**: `MapCanvas.jsx` defines a `COLORS` constant because Leaflet `pathOptions` cannot read CSS custom properties at paint time. The tile layer grayscale filter IS theme-aware via `var(--map-filter)` in `.map-tiles-grayscale`.
    *   **Design.md updated**: Both palettes documented as source of truth with SVG color rules.
11. ✅ **Global AI Assistant**: Implemented `AIAssistant.jsx` as a floating bottom-right chat widget available on all pages (mounted in `Layout.jsx`).
    *   **Context Scope**: Automatically picks up `well_id` from URL when on `WellMap` or `WellDetails`, showing a "Scoped to DLJ-XXX" indicator that can be cleared.
    *   **Mock API**: Keyword-based retrieval in `assistant.api.js` over `events.json`. Returns templated answer, citations (doc/page/event), relevant wells, and confidence.
    *   **UI Features**: Expandable panel, auto-scrolling message history, Markdown/plain-text responses, clickable citations routing to `WellDetails`, clickable relevant well routing, and a pulsing loading indicator simulating latency.
    *   **Robustness**: Keyboard accessibility (Enter/Escape), viewport cap for mobile, no overlap with `Documents` page UI, and persists state across navigations within the session.

### Intentionally Skipped (optional F1–F13 items from NWIS_PLAN.md)
The following were out of scope for this SIH prototype sprint:
- **F4** Real-time WebSocket telemetry (currently synthetic mock via realtime.json)
- **F5** PDF OCR backend (currently a 6-second simulated progression)
- **F7** Risk scoring ML model integration (currently static risk.json)
- **F9** User authentication / roles
- **F10** Offline caching / PWA shell
- **F11** Admin panel
- **F12** Export to PDF/CSV
- **F13** Geospatial import of real well survey data (currently hardcoded lat/lon)


## How to Run
```bash
npm install
npm run dev
```

*Note: If running on Windows PowerShell causes execution policy errors, use `cmd /c npm run dev`.*
