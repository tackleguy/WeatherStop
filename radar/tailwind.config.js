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
          'SF Pro Text',
          'system-ui',
          'sans-serif',
        ],
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.92)' },
        },
        'alert-pulse': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.2s cubic-bezier(0.4,0,0.6,1) infinite',
        'alert-pulse': 'alert-pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
