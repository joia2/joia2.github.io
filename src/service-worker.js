import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// One cache per deploy; old ones are deleted on activate
const CACHE = `cache-${version}`;

// The app shell: built JS/CSS, files in static/, and prerendered pages.
// Dotfiles like .nojekyll are skipped: one failed download aborts the whole install.
const SHELL = new Set(
	[...immutable, ...assets, ...prerendered]
		.filter(({ path }) => !path.split('/').pop().startsWith('.'))
		.map(({ path }) => new URL(path, self.registration.scope).pathname)
);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...SHELL]);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

// The installed app's first start: it checks this worker answers /__handoff/ itself before loading it
self.addEventListener('message', (event) => {
	if (event.data === 'handoff?') event.ports[0]?.postMessage(true);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// The browser's login is in a cookie for this page only (session.svelte.js). Answered here, so the
	// request, cookie included, never reaches the server; the page hands the cookie to the app.
	if (url.origin === self.location.origin && url.pathname === '/__handoff/') {
		const page = '<!doctype html><script>parent.postMessage(document.cookie, location.origin)</script>';
		event.respondWith(new Response(page, { headers: { 'content-type': 'text/html' } }));
		return;
	}

	// Only handle our own GET requests; GitHub API calls go straight to the network
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Pages: always ask GitHub for the latest deploy, so a refresh shows it; the cache is
			// only for offline. no-cache skips the browser's own copy, which Pages lets live 10 minutes.
			if (event.request.mode === 'navigate') {
				try {
					return await fetch(event.request, { cache: 'no-cache' });
				} catch {
					return (await cache.match(url.pathname)) ?? (await cache.match('/')) ?? Response.error();
				}
			}

			// App shell files never change within a deploy, so serve them from the cache
			if (SHELL.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Anything else: network first, fall back to the cache when offline
			try {
				return await fetch(event.request);
			} catch {
				return (await cache.match(event.request)) ?? (await cache.match('/')) ?? Response.error();
			}
		})()
	);
});
