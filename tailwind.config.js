/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'Arial', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        /* Left navigation. Like brand, ink and line below, these read CSS variables so the
           theme chosen in Account & Settings → Portal can restyle the portal (see index.css). */
        rail: {
          DEFAULT: 'rgb(var(--rail) / <alpha-value>)',
          hover: 'rgb(var(--rail-hover) / <alpha-value>)',
          active: 'rgb(var(--rail-active) / <alpha-value>)',
          text: 'rgb(var(--rail-text) / <alpha-value>)',
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
          DEFAULT: 'rgb(var(--brand-700) / <alpha-value>)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        gold: {
          400: '#e3c456',
          500: '#c9a227',
          600: '#a8851d',
        },
        ink: {
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
        },
        /* Hairline used for every card, table and input border. */
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        canvas: '#ffffff',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.03)',
        'card-hover': '0 6px 18px rgba(16, 24, 40, 0.08)',
        pop: '0 8px 28px rgba(16, 24, 40, 0.10)',
      },
      borderRadius: {
        card: '8px',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        growWidth: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out both',
        'scale-in': 'scaleIn 0.18s ease-out both',
        'slide-in-right': 'slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.24s ease-out both',
        'grow-width': 'growWidth 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
