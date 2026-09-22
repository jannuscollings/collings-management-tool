/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  // Dark mode follows the `dark` class on <html> (set by contexts/ThemeContext),
  // not the OS setting — users opt in. Same convention as the Collings CRM.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#4ECCDA",
        secondary: "#1F2937",
        success: "#2ECC71",
        warning: "#F1C40F",
        danger: "#E74C3C",
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--color-brand-strong) / <alpha-value>)",
        "brand-soft": "rgb(var(--color-brand-soft) / <alpha-value>)",
        navy: "rgb(var(--color-navy) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        copy: "rgb(var(--color-copy) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        positive: "rgb(var(--color-positive) / <alpha-value>)",
        critical: "rgb(var(--color-critical) / <alpha-value>)",
        caution: "rgb(var(--color-caution) / <alpha-value>)",
        review: "rgb(var(--color-review) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        product: ["Urbanist", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        "ds-xs": "8px",
        "ds-sm": "9px",
        "ds-md": "12px",
        "ds-lg": "16px",
        "ds-pill": "999px",
      },
      boxShadow: {
        panel: "0 8px 24px rgba(18, 39, 43, 0.07)",
        overlay: "0 18px 55px rgba(15, 35, 40, 0.16)",
      },
      screens: {
        shell: "900px",
      },
    },
  },
  plugins: [],
};
