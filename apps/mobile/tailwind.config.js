/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: '#FF5A3C',
          50: '#FFF1EE',
          100: '#FFE0D8',
          200: '#FFBFB0',
          300: '#FF9578',
          400: '#FF7150',
          500: '#FF5A3C',
          600: '#E83E1F',
          700: '#C32D14',
          800: '#9E2410',
          900: '#7D1E0D',
          foreground: '#FFFFFF',
        },
        // Semantic
        success: { DEFAULT: '#059669', foreground: '#FFFFFF', light: '#D1FAE5' },
        warning: { DEFAULT: '#F59E0B', foreground: '#FFFFFF', light: '#FEF3C7' },
        danger:  { DEFAULT: '#EF4444', foreground: '#FFFFFF', light: '#FEE2E2' },
        info:    { DEFAULT: '#3B82F6', foreground: '#FFFFFF', light: '#DBEAFE' },
        // Background
        background: '#F8FAFC',
        card:       '#FFFFFF',
        muted:      '#F1F5F9',
        // Text
        foreground:       '#0F172A',
        'muted-foreground': '#64748B',
        // Border
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
