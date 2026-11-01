import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// One cache per deploy; old ones are deleted on activate
const CACHE = `cache-${version}`;

// The app shell: built JS/CSS, files in static/, and prerendered pages.
// Dotfiles like .nojekyll are skipped: one failed download aborts the whole install.
const SHELL = [...immutable, ...assets, ...prerendered]
	.filter(({ path }) => !path.split('/').pop().startsWith('.'))
	.map(({ path }) => new URL(path, self.registration.scope).pathname);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only handle our own GET requests; GitHub API calls go straight to the network
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// App shell files never change within a deploy, so serve them from the cache
			if (SHELL.includes(url.pathname)) {
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
