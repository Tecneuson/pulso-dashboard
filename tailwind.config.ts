import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['36px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['28px', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-md': ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        heading: ['18px', { lineHeight: '1.3', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.45' }],
        'body-sm': ['13px', { lineHeight: '1.4' }],
        caption: ['12px', { lineHeight: '1.35' }],
        overline: ['11px', { lineHeight: '1.3', letterSpacing: '0.06em', fontWeight: '600' }],
        'mono-lg': ['28px', { lineHeight: '1.1', fontWeight: '600' }],
        mono: ['14px', { lineHeight: '1.45' }],
        'mono-sm': ['12px', { lineHeight: '1.4' }],
      },
      colors: {
        brand: {
          50: '#E6F5ED',
          100: '#C0E6D1',
          200: '#96D4B2',
          300: '#6CC293',
          400: '#4DB57C',
          500: '#2EA866',
          600: '#28965A',
          700: '#1F7A49',
          800: '#175E38',
          900: '#0E3F25',
        },
        surface: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          hover: 'var(--border-hover)',
          active: 'var(--border-active)',
          strong: 'var(--border-strong)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text)',
          'text-active': 'var(--sidebar-text-active)',
          hover: 'var(--sidebar-hover)',
          'active-bg': 'var(--sidebar-active-bg)',
          border: 'var(--sidebar-border)',
        },
        success: { 50: '#ECFDF3', 500: '#12B76A', 600: '#039855', 700: '#027A48' },
        warning: { 50: '#FFFAEB', 500: '#F79009', 600: '#DC6803', 700: '#B54708' },
        danger: { 50: '#FEF3F2', 500: '#F04438', 600: '#D92D20', 700: '#B42318' },
        info: { 50: '#EFF8FF', 500: '#2E90FA', 600: '#1570EF', 700: '#175CD3' },
        neutral: { 50: '#F5F5F4', 500: '#78786E', 600: '#5C5C54', 700: '#44443E' },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        elevated: 'var(--shadow-elevated)',
        modal: 'var(--shadow-modal)',
      },
      ringColor: {
        DEFAULT: 'var(--ring-color)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'count-up': 'countUp 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        countUp: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
