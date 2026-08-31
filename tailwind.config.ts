/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Height-based breakpoint. Laptop viewports vary far more in height than
      // width (a 13" browser window is ~760px tall, a 14" ~860px), so sections
      // that must be taken in at a glance size their vertical rhythm off this
      // rather than off the `sm:`/`lg:` width breakpoints. The threshold sits
      // above any laptop so only external monitors get the roomier spacing.
      screens: {
        tall: { raw: '(min-height: 940px)' },
      },
      colors: {
        primary: {
          DEFAULT: '#B45309',
          light: '#D97706',
          lighter: '#F59E0B',
        },
        heading: '#1C1917',
        body: '#44403C',
        // stone-500: the old stone-400 (#A8A29E) fails WCAG AA (2.41:1) for the
        // small labels this token is used on against the cream surfaces.
        muted: '#78716C',
        surface: {
          DEFAULT: '#FAFAF7',
          raised: '#FFFCF8',
          warm: '#F5F0EB',
        },
        success: '#16A34A',
        danger: '#DC2626',
        border: {
          DEFAULT: 'rgba(0,0,0,0.06)',
          hover: 'rgba(0,0,0,0.10)',
        },
        // Two neutral edge weights, not six. Flat keys so the utilities read as
        // `border-hairline` / `divide-hairline` rather than `border-border-*`.
        // hairline: dividers, section rules and passive card edges.
        // defined:  interactive edges — inputs, buttons, clickable-card hover.
        // Tinted off the heading stone (#1C1917) so edges stay warm on cream.
        hairline: 'rgba(28,25,23,0.06)',
        defined: 'rgba(28,25,23,0.12)',
        // v4 design tokens (§1.2)
        'bg-page': '#F5EEE3',
        'bg-card': '#FBF7F1',
        'text-primary': '#1F1A14',
        'text-secondary': '#5A4F45',
        'text-muted-warm': '#8A7E72',
        'accent-primary': '#C2410C',
        'accent-soft': '#F4A98A',
        'border-card': 'rgba(31, 26, 20, 0.08)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-bar': {
          '0%, 100%': { height: '10%' },
          '50%': { height: '100%' },
        },
        // Magic UI keyframes
        'shimmer-slide': {
          to: { transform: 'translate(calc(100cqw - 100%), 0)' },
        },
        'spin-around': {
          '0%': { transform: 'translateZ(0) rotate(0)' },
          '15%, 35%': { transform: 'translateZ(0) rotate(90deg)' },
          '65%, 85%': { transform: 'translateZ(0) rotate(270deg)' },
          '100%': { transform: 'translateZ(0) rotate(360deg)' },
        },
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'marquee-vertical': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(calc(-100% - var(--gap)))' },
        },
        'gradient-bg': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        // Live consultation. Both are transform/opacity only so they stay on
        // the compositor: they run for minutes at a time on a phone that is
        // also holding a WebRTC call and a screen wake lock, and both are used
        // through `motion-safe:` so `prefers-reduced-motion` stops them dead.
        //
        // The orb's resting state when nobody is talking. Kept tiny — this is
        // "alive", not "animated".
        'orb-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.025)' },
        },
        // A ring leaving the connect pulse. Starts at the ring's own resting
        // size so that with the animation off the three rings still read as
        // concentric rather than collapsing on top of each other.
        'connect-ping': {
          '0%': { transform: 'scale(1)', opacity: 'var(--ping-opacity, 0.5)' },
          '80%, 100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        'infinite-scroll': 'infinite-scroll 40s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        // Magic UI animations
        'shimmer-slide': 'shimmer-slide var(--speed) ease-in-out infinite alternate',
        'spin-around': 'spin-around calc(var(--speed) * 2) infinite linear',
        'border-beam': 'border-beam calc(var(--duration)) infinite linear',
        marquee: 'marquee var(--duration) infinite linear',
        'marquee-vertical': 'marquee-vertical var(--duration) infinite linear',
        'gradient-bg': 'gradient-bg 8s linear infinite',
        'gradient-text': 'gradient-bg 8s linear infinite',
        'orb-breathe': 'orb-breathe 5s ease-in-out infinite',
        'connect-ping': 'connect-ping 2.4s cubic-bezier(0.25,0.6,0.35,1) infinite',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        // e1–e3 are resting surfaces: near-hairline, tinted off the heading stone
        // (#1C1917) rather than pure black. e4 is reserved for things that
        // genuinely float — modals, popovers, dropdowns.
        'elevation-1': '0 1px 0 rgba(28,25,23,0.04)',
        'elevation-2': '0 1px 2px rgba(28,25,23,0.05), 0 1px 0 rgba(28,25,23,0.03)',
        'elevation-3': '0 2px 6px -1px rgba(28,25,23,0.07), 0 1px 0 rgba(28,25,23,0.03)',
        'elevation-4': '0 12px 32px -12px rgba(28,25,23,0.18)',
        'card-chrome': '0 1px 2px rgba(31, 26, 20, 0.04), 0 4px 8px rgba(31, 26, 20, 0.04)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}