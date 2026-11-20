/** @type {import('tailwindcss').Config} */
// Palette from the official CIMP-BIIF logo: bodhi-tree greens, saffron motto, charcoal text.
// Token names (navy, brand, …) are kept so existing classes pick up the new colours.
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#F5F8F0', // page background, faint leaf tint
        'bg-alt': '#EAF2DF',
        surface:  '#FFFFFF',
        'surface-2': '#F9FBF5',
        border:   '#DCE5D0',
        'border-2': '#C3D3AE',
        navy:     '#1C3510', // deep forest: headings, dark sections (contrast 13.4 with white)
        'navy-2': '#2E5016',
        brand:    '#3F7A16', // bodhi green: buttons, links (5.2 with white)
        'brand-2':'#8CC63F', // logo lime: focus rings, highlights
        leaf: {
          50:  '#F2F8EA',
          100: '#E3F0D2',
          200: '#C8E2A6',
          300: '#A6D45A',
          400: '#8CC63F',
          500: '#6FAE2E',
          600: '#4E8A1F',
          700: '#3F7A16',
          800: '#2E5E14',
          900: '#1C3510',
        },
        saffron: {
          50:  '#FEF3EA',
          100: '#FDE3CC',
          400: '#F08A3C',
          500: '#E8731A', // logo tagline
          600: '#C2570C', // text-safe saffron (4.5 with white)
        },
        muted:    '#6A7860',
        faint:    '#A3B096',
        secondary:'#4A5A3F',
        amber:    '#C2570C',
        'amber-bg':'#FEF3EA',
      },
      fontFamily: {
        // Montserrat: closest free match to the logo's "CIMP-BIIF" lettering; Noto Sans Devanagari renders the Hindi motto
        display: ['Montserrat', 'Noto Sans Devanagari', 'sans-serif'],
        body:    ['Montserrat', 'Noto Sans Devanagari', 'sans-serif'],
        // Labels/badges also use the logo font (Montserrat) with tabular numbers (see globals.css)
        mono:    ['Montserrat', 'Noto Sans Devanagari', 'sans-serif'],
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'pulse-amber':'pulseAmber 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp:    { from:{opacity:'0',transform:'translateY(12px)'}, to:{opacity:'1',transform:'translateY(0)'} },
        fadeIn:    { from:{opacity:'0'}, to:{opacity:'1'} },
        pulseAmber:{ '0%,100%':{boxShadow:'0 0 0 0 rgba(232,115,26,0)'}, '50%':{boxShadow:'0 0 0 6px rgba(232,115,26,0.2)'} },
      },
      boxShadow: {
        card:    '0 1px 3px rgba(28,53,16,0.06), 0 1px 2px rgba(28,53,16,0.04)',
        'card-md':'0 4px 12px rgba(28,53,16,0.08), 0 2px 4px rgba(28,53,16,0.04)',
        'card-lg':'0 10px 30px rgba(28,53,16,0.1), 0 4px 8px rgba(28,53,16,0.06)',
        blue:    '0 0 0 3px rgba(140,198,63,0.25), 0 4px 12px rgba(63,122,22,0.15)',
        amber:   '0 0 0 3px rgba(232,115,26,0.15), 0 4px 12px rgba(232,115,26,0.12)',
      },
    },
  },
  plugins: [],
};
