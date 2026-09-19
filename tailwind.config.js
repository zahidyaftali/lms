/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
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
          900: '#111827',
          700: '#374151',
          500: '#6b7280',
          400: '#9ca3af',
        },
        line: '#e5e7eb',
        canvas: '#ffffff',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        pop: '0 10px 30px rgba(16,24,40,0.12)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
