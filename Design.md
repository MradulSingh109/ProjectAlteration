# Design rules

- One visual identity: warm, industrial, high-contrast. Supports dark and light themes.
- One font: IBM Plex Sans. Numbers like depth can use tabular numerals.
- Sharp or lightly rounded corners (max 4px). No glassmorphism, no gradients,
  no glowing effects, no emoji icons.
- Big clear labels, readable text sizes (min 14px for body).
- Simple layout, lots of clarity, no clutter.
- Animations: none, except a simple highlight on new alerts.
- Every alert must show its source (which well, which depth, which report).

## Color tokens (source of truth)

All new components must use these token names — never a raw hex value.

| Token        | Tailwind class  | CSS var         | Dark value  | Light value |
|--------------|-----------------|-----------------|-------------|-------------|
| Background   | `bg-background` | `var(--bg)`     | `#1a1712`   | `#faf7f0`   |
| Panel        | `bg-panel`      | `var(--panel)`  | `#211d17`   | `#ffffff`   |
| Panel alt    | `bg-panel-alt`  | `var(--panel2)` | `#28231b`   | `#f3efe4`   |
| Border       | `border-line`   | `var(--line)`   | `#3a3226`   | `#ddd6c4`   |
| Text         | `text-foreground`| `var(--ink)`   | `#ece3d3`   | `#2a2419`   |
| Text dim     | `text-dim`      | `var(--ink-dim)`| `#a89a83`   | `#5c5340`   |
| Text faint   | `text-faint`    | `var(--ink-faint)`| `#6e6250` | `#8a8066`   |
| Danger/High  | `text-danger`   | `var(--rust)`   | `#c1440e`   | `#a83b0d`   |
| Caution/Med  | `text-caution`  | `var(--ochre)`  | `#c99a3a`   | `#a67d24`   |
| Normal/Low   | `text-normal`   | `var(--steel)`  | `#5f7f8f`   | `#3f6272`   |
| Success      | `text-success`  | `var(--olive)`  | `#7c8a5c`   | `#5f6b45`   |

## Theme toggling

- Theme is toggled via a button in Layout's sidebar (bottom, sun/moon icon).
- State is stored in `localStorage` under the key `nwis-theme`.
- On first load: localStorage → OS `prefers-color-scheme` → default dark.
- The toggle sets `data-theme="dark|light"` on `<html>`.
- All CSS tokens live in `[data-theme="dark"]` and `[data-theme="light"]` blocks in `index.css`.

## SVG color rules

SVG `stroke` and `fill` attributes **cannot** automatically inherit CSS custom
properties the same way HTML elements do. Always set them explicitly with
`stroke="var(--rust)"` style attributes (NOT Tailwind classes) when inside SVG elements.
Leaflet `pathOptions` is the one exception — Leaflet draws to Canvas/SVG at paint time
and cannot read CSS vars, so use the `COLORS` constant in `MapCanvas.jsx`.