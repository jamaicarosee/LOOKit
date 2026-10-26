// TAILWIND CSS DESIGN FOR WHOLE LOOKIT



/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        campus: {
          mae: "#E67E22",      // Orange - M.A.E Building
          ced: "#2980B9",      // Blue - CED Building
          cas: "#27AE60",      // Green - CAS Building
          javier: "#F1C40F",   // Yellow - Javier Building
          canvas: "#F8F9F9",   // Neutral Canvas Background
          landing: "#E5E8E8",  // Downstairs Landing / Transit Pad
          buffer: "#BDC3C7",   // Structural Buffer Outline
          tread: "#D5D8DC",    // 3D Step Treads
          pwd: {
            light: "#A2D9CE",  // PWD Ramp Surface
            dark: "#48C9B0",   // PWD Ramp Accent Outline
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
}