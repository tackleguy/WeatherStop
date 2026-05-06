/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      colors: {
        ink: {
          950: '#0a0e1a',
          900: '#111827',
          800: '#1f2937',
          700: '#374151',
        },
      },
      keyframes: {
        'tornado-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'tornado-pulse': 'tornado-pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
