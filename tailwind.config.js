/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette lifted from the Sentinel mobile app: light ground, deep teal
        // primary, red reserved for emergency actions.
        ink: { DEFAULT: '#111827', soft: '#6b7280', faint: '#9ca3af' },
        ground: { DEFAULT: '#f2f4f7', card: '#ffffff', line: '#e6e8ec' },
        brand: {
          50: '#eefbf7', 100: '#d3f4ea', 200: '#a8e8d7',
          500: '#12a789', 600: '#0f8a72', 700: '#0d7360', 800: '#0b5f50',
        },
        sev: { normal: '#16a34a', moderate: '#d97706', severe: '#dc2626' },
        unit: {
          ambulance: '#0d7360',
          fire: '#ea580c',
          police: '#2563eb',
          rescue: '#7c3aed',
        },
      },
      borderRadius: { xl2: '1rem' },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        lift: '0 4px 12px rgba(16,24,40,0.08)',
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'slide-in': 'slide-in 0.35s ease-out' },
    },
  },
  plugins: [],
}
