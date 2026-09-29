/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // All values read from CSS custom properties set by [data-theme] on <html>.
        // Never use raw hex values in components — always use these aliases.
        background: 'var(--bg)',
        panel:      'var(--panel)',
        'panel-alt': 'var(--panel2)',
        line:       'var(--line)',
        foreground: 'var(--ink)',
        dim:        'var(--ink-dim)',
        faint:      'var(--ink-faint)',
        danger:     'var(--rust)',
        caution:    'var(--ochre)',
        normal:     'var(--steel)',
        success:    'var(--olive)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
