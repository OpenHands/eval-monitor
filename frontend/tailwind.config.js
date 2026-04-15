/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'oh': {
          'bg': '#171717',
          'surface': '#262626',
          'surface-hover': '#333333',
          'border': '#404040',
          'primary': '#4B82F7',
          'primary-hover': '#3B72E7',
          'text': '#FAFAFA',
          'text-muted': '#A3A3A3',
          'success': '#22C55E',
          'warning': '#F59E0B',
          'error': '#EF4444',
          'info': '#38BDF8',
          'purple': '#A855F7',
        }
      }
    },
  },
  plugins: [],
}
