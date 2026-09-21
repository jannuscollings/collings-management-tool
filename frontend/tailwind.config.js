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
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
