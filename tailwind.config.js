const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'medical-blue': '#0EA5E9',
        'ai-purple': '#6366F1',
        'accent-cyan': '#06B6D4',
        'neutral-900': '#111827',
        'neutral-50': '#F9FAFB',
      },
    },
  },
  plugins: [],
} 