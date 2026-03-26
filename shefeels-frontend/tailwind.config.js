/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./index.html',
		'./src/**/*.{ts,tsx,js,jsx,html}'
	],
	darkMode: ['class', '[data-theme="dark"]'],
	theme: {
		extend: {
			fontFamily: {
					sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
			},
			colors: {
				// Light theme colors
				'light-bg': '#ffffff',
				'light-surface': '#f8fafc',
				'light-border': '#e2e8f0',
				'light-text': '#0f172a',
				'light-text-secondary': '#475569',
				'light-accent': 'var(--hl-gold-strong)',
				'light-accent-hover': '#A67C00',
				
				// Dark theme colors
				'dark-bg': '#000000',
				'dark-surface': '#0f172a',
				'dark-border': '#1e293b',
				'dark-text': '#f1f5f9',
				'dark-text-secondary': '#cbd5e1',
				'dark-accent': '#E4B659',
				'dark-accent-hover': '#ffc54d',
				
				// Figma design system colors
				hl: {
					bg: 'var(--hl-bg)',
					surface: 'var(--hl-surface)',
					surface2: 'var(--hl-surface-2)',
					border: 'var(--hl-border)',
					ring: 'var(--hl-ring)',
					gold: 'var(--hl-gold)',
					goldStrong: 'var(--hl-gold-strong)',
					goldWeak: 'var(--hl-gold-weak)',
					text: 'var(--hl-text)',
					dim: 'var(--hl-text-dim)',
					mute: 'var(--hl-text-mute)',
				},
			},
			borderRadius: {
				hero: 'var(--r-hero)',
				card: 'var(--r-card)',
				chip: 'var(--r-chip)',
				input: 'var(--r-input)',
			},
			boxShadow: {
				hero: 'var(--sh-hero)',
				card: 'var(--sh-card)',
				lift: 'var(--sh-lift)',
			},
			transitionTimingFunction: {
				pleasant: 'var(--easing)',
			},
			transitionDuration: {
				pleasant: 'var(--dur)',
			},
			container: {
				center: true,
				padding: { DEFAULT: '1.5rem', lg: '2rem' },
				screens: { '2xl': '1320px' },
			},
			screens: {
				'xs': '475px',
			},
			spacing: {
				'safe-top': 'env(safe-area-inset-top)',
				'safe-bottom': 'env(safe-area-inset-bottom)',
				'safe-left': 'env(safe-area-inset-left)',
				'safe-right': 'env(safe-area-inset-right)',
			},
		},
	},
	plugins: [],
}
