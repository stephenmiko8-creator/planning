export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: 'var(--bg-color-to)',
          850: 'var(--bg-color-from)',
          800: 'var(--panel-bg)',
        },
        neon: {
          purple: 'var(--accent-purple)',
          teal: 'var(--accent-teal)',
          blue: 'var(--accent-blue)',
        },
        gray: {
          300: 'var(--text-300)',
          400: 'var(--text-400)',
        },
        white: 'var(--text-white-custom)',
      },
    },
  },
  plugins: [],
}
