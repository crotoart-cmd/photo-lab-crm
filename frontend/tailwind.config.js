/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '12px',
        'md-lg': '16px',
        'md-xl': '28px',
      },
      colors: {
        lab: {
          50: '#f8f9fc',
          100: '#eceef2',
          200: '#d4e4f7',
          500: '#2f5883',
          600: '#2f5883',
          700: '#234262',
          800: '#1a3350',
          900: '#1a1c1e',
        },
        md: {
          primary: '#2f5883',
          'on-primary': '#ffffff',
          'primary-container': '#d4e4f7',
          surface: '#f8f9fc',
          'on-surface': '#1a1c1e',
          'on-surface-variant': '#42474e',
          outline: '#73777f',
          error: '#ba1a1a',
          tertiary: '#2e6b4f',
        },
      },
    },
  },
  plugins: [],
};
