import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({ fallback: '404.html' }),
			// The deploy's run number on GitHub ("v 42"), shown on the login screen and in the menu
			version: { name: process.env.GITHUB_RUN_NUMBER ?? 'dev' }
		})
	]
});
