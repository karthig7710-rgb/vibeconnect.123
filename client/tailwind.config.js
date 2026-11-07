/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: 'rgb(var(--c-night) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        vibe: {
          DEFAULT: 'rgb(var(--c-vibe) / <alpha-value>)',
          soft: 'rgb(var(--c-soft) / <alpha-value>)',
          pink: 'rgb(var(--c-pink) / <alpha-value>)',
        },
        amber: { vibe: 'rgb(var(--c-amber) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"Trebuchet MS"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.92)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slideIn: { '0%': { transform: 'translateX(24px)', opacity: 0 }, '100%': { transform: 'translateX(0)', opacity: 1 } },
        dot: { '0%,60%,100%': { transform: 'translateY(0)', opacity: 0.4 }, '30%': { transform: 'translateY(-4px)', opacity: 1 } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        bars: { '0%,100%': { height: '30%' }, '50%': { height: '100%' } },
        drop: { '0%': { transform: 'translateY(-420%)' }, '70%': { transform: 'translateY(6%)' }, '100%': { transform: 'translateY(0)' } },
        shine: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' } },
      },
      animation: {
        pop: 'pop .18s ease-out',
        rise: 'rise .22s ease-out',
        slideIn: 'slideIn .25s ease-out',
        dot: 'dot 1.2s infinite',
        spinSlow: 'spinSlow 8s linear infinite',
        bars: 'bars .9s ease-in-out infinite',
        drop: 'drop .45s cubic-bezier(.3,.7,.4,1)',
        shine: 'shine 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
