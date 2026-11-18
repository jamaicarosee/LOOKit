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
<<<<<<< HEAD
=======
      // Launch sequence (splash + skeleton)
            // Launch sequence (splash + skeleton)
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "splash-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "loading-slide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        "blink-lid": {
          "0%, 10%, 26%, 100%": { transform: "translateY(-100%)" },
          "18%": { transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "splash-in": "splash-in 600ms ease-out both",
        "loading-slide": "loading-slide 1.2s ease-in-out infinite",
        "blink-lid": "blink-lid 2.4s ease-in-out infinite",
      },
>>>>>>> 73e09d3 (added skeletal loading and current location)
    },
  },
  plugins: [],
}