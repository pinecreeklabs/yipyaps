import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const config = defineConfig({
	plugins: [
		// Cloudflare plugin first (per official Cloudflare docs)
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
		// Then TanStack Start
		tanstackStart(),
		devtools(),
		viteTsConfigPaths({
			projects: ['./tsconfig.json'],
		}),
		tailwindcss(),
		viteReact(),
	],
	optimizeDeps: {
		exclude: ['cloudflare:workers'],
	},
	ssr: {
		noExternal: ['@tanstack/react-start'],
		resolve: {
			conditions: ['worker', 'import'],
		},
	},
})

export default config
