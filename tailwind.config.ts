import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#EDF7EC',
          100: '#D4ECD3',
          200: '#B3DEB1',
          300: '#8ECE8B',
          400: '#76C472',
          500: '#64b560',
          600: '#529A4E',
          700: '#3F7A3D',
          800: '#2D5B2C',
          900: '#1B3A1B',
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
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text)',
          'text-active': 'var(--sidebar-text-active)',
          hover: 'var(--sidebar-hover)',
          'active-bg': 'var(--sidebar-active-bg)',
          border: 'var(--sidebar-border)',
        },
        success: {
          50: '#ECFDF3',
          500: '#12B76A',
          700: '#027A48',
        },
        warning: {
          50: '#FFFAEB',
          500: '#F79009',
          700: '#B54708',
        },
        danger: {
          50: '#FEF3F2',
          500: '#F04438',
          700: '#B42318',
        },
        info: {
          50: '#EFF8FF',
          500: '#2E90FA',
          700: '#175CD3',
        },
        neutral: {
          50: '#F5F5F4',
          500: '#78786E',
          700: '#44443E',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        elevated: '0 8px 24px rgba(0, 0, 0, 0.08)',
        modal: '0 16px 48px rgba(0, 0, 0, 0.12)',
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
      },
    },
  },
  plugins: [],
}

export default config
