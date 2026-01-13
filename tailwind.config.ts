/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1754cf",
        "primary-hover": "#1342a6",
        "background-dark": "#0f172a",
        "background-card": "#1e293b",
        "accent-green": "#22c55e",
        "medical-blue": "#1754cf",
        "ai-purple": "#8b5cf6",
        "accent-cyan": "#22d3ee",
        "neutral-900": "#0f172a",
        "neutral-50": "#f8fafc",
        // Dashboard-specific colors
        "dashboard-dark": "#070A13",
        "card-glass": "rgba(21, 26, 46, 0.6)",
        "sidebar-dark": "#0B0F1A",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
        'dashboard-gradient': 'radial-gradient(circle at top right, #1e1b4b 0%, #070A13 100%)',
        'purple-indigo-vibrant': 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
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
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        'infinite-scroll': 'infinite-scroll 40s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glass-sm': '0 4px 15px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        'glass-glow': '0 0 20px -5px rgba(139, 92, 246, 0.3)',
        'lift': '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}