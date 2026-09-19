/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'Arial', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        /* Left navigation: royal blue rail with a darker active row. */
        rail: {
          DEFAULT: '#1052a8',
          hover: '#1a5cb4',
          active: '#0a3c86',
        },
        navy: {
          50: '#eef3fb',
          100: '#d6e2f5',
          200: '#a9c1e8',
          300: '#6f95d4',
          400: '#3b6ac0',
          500: '#1b4da8',
          600: '#0f3c8c',
          700: '#092f73',
          800: '#04255e',
          900: '#012053',
        },
        brand: {
          DEFAULT: '#1a56db',
          50: '#eff4ff',
          100: '#dbe6fe',
          200: '#bed0fe',
          300: '#91b0fd',
          400: '#6288fa',
          500: '#3f63f5',
          600: '#2544e9',
          700: '#1a56db',
          800: '#1c3aad',
          900: '#1e3888',
        },
        gold: {
          400: '#e3c456',
          500: '#c9a227',
          600: '#a8851d',
        },
        ink: {
          900: '#232323',
          700: '#4f4f4f',
          500: '#757575',
          400: '#a0a0a0',
        },
        /* Hairline used for every card, table and input border. */
        line: '#ededf1',
        'line-strong': '#e2e4ea',
        canvas: '#ffffff',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.03)',
        pop: '0 8px 28px rgba(16, 24, 40, 0.10)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
}
