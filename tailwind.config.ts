import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nativewindPreset = require('nativewind/preset');

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        neonPink: '#FF007F',
        neonCyan: '#00FFFF',
      },
    },
  },
  plugins: [],
};

export default config;
