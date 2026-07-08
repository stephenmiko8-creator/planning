export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f172a', // Deep slate
          800: '#1e293b', // Lighter slate
        },
        neon: {
          purple: '#c084fc',
          teal: '#2dd4bf',
          blue: '#38bdf8',
        }
      },
    },
  },
  plugins: [],
}
