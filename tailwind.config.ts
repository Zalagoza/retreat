import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rast: {
          red: '#C8102E',
          gold: '#FFCE00',
          green: '#007A3D',
          night: '#0D0D0D',
          charcoal: '#1A1A1A',
          smoke: '#262626',
          cream: '#F5F1E8',
        },
      },
      fontFamily: {
        montserrat: ['var(--font-montserrat)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
