/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Our custom eco-vibe / marine response palette
        trench: '#020813',   // Near-black bioluminescent abyssal ocean floor
        coral: {
          400: '#ff826e',   // Warning/Critical state alert coral
          500: '#ff5a43',   // Vibrant reef coral for primary UI accents
        },
        seafoam: {
          400: '#7ef1c3',  // Bio-luminescent operational nominal status
          500: '#4adea7',  // Deep seafoam green for safe metrics
        },
        kelp: '#1e3a34',    // Subdued background tint for control cards
      },
    },
  },
  plugins: [],
}