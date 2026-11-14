<script>
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Download from '@lucide/svelte/icons/download';
	import Sheet from '#lib/Sheet.svelte';
	import { tick } from 'svelte';
	import { download } from '#lib/attachments.js';

	// An attachment shown inside the app: an image, or a PDF in the browser's own viewer.
	// file: { name, type, id } once saved, or { name, type, file } (a File) before
	let { file, open = $bindable(false) } = $props();

	let url = $state('');
	let error = $state('');

	$effect(() => {
		if (!open || !file) return;
		let blobUrl = '';
		let cancelled = false;
		error = '';
		(file.file ? Promise.resolve(file.file) : download(file.id))
			.then((blob) => {
				if (cancelled) return;
				blobUrl = URL.createObjectURL(blob);
				url = blobUrl;
			})
			.catch((e) => (error = e.message));
		return () => {
			cancelled = true;
			url = '';
			scale = 1;
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	});

	// Zooming into an image: pinch with two fingers, or tap twice (double-click) to zoom in and
	// out at that point; one finger then moves around. The image is drawn larger and the box
	// scrolls, keeping the point under the fingers in place.
	let scale = $state(1);
	let base = { w: 0, h: 0 }; // the image's size when it fits
	let box = $state();
	const MAX = 6;
	async function zoomAt(next, x, y) {
		next = Math.min(MAX, Math.max(1, next));
		const r = box.getBoundingClientRect();
		const px = x - r.left + box.scrollLeft;
		const py = y - r.top + box.scrollTop;
		const k = next / scale;
		scale = next;
		await tick();
		box.scrollLeft = px * k - (x - r.left);
		box.scrollTop = py * k - (y - r.top);
	}
	const fitted = (e) => (base = { w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight });

	const pointers = new Map();
	let pinch = null; // { distance, scale } when two fingers went down
	let lastTap = 0;
	const distance = () => {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};
	function down(e) {
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2) pinch = { distance: distance(), scale };
	}
	function move(e) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size !== 2 || !pinch) return;
		const [a, b] = [...pointers.values()];
		zoomAt((pinch.scale * distance()) / pinch.distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
	}
	function up(e) {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinch = null;
		if (e.type !== 'pointerup' || pointers.size) return;
		const now = Date.now();
		if (now - lastTap < 300) zoomAt(scale > 1 ? 1 : 2.5, e.clientX, e.clientY), (lastTap = 0);
		else lastTap = now;
	}
</script>

<Sheet title={file?.name ?? ''} bind:open>
	{#snippet actions()}
		{#if url}
			<a class="icon-button" href={url} download={file.name} aria-label="download"><Download size={22} /></a>
		{/if}
	{/snippet}
	<div class="view" bind:this={box}>
		{#if error}
			<p class="error">{error}</p>
		{:else if !url}
			<LoaderCircle size={24} class="spin" />
		{:else if file.type.startsWith('image/')}
			<img
				src={url}
				alt={file.name}
				class:zoomed={scale > 1}
				style:width={scale > 1 ? `${base.w * scale}px` : null}
				style:height={scale > 1 ? `${base.h * scale}px` : null}
				onload={fitted}
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
				draggable="false"
			/>
		{:else}
			<iframe src={url} title={file.name}></iframe>
		{/if}
	</div>
</Sheet>

<style>
	/* margin: auto centers the image while it fits, and lets the box scroll to every side of it
	   once zoomed */
	.view {
		display: flex;
		min-height: 12rem;
		max-height: 75vh;
		padding: 0 1rem 1rem;
		overflow: auto;
	}
	.view > :global(*) {
		margin: auto;
	}
	img {
		flex-shrink: 0;
		max-width: 100%;
		max-height: 70vh;
		border-radius: 8px;
		touch-action: pan-x pan-y; /* one finger scrolls; two are the zoom's */
		-webkit-user-select: none;
		user-select: none;
	}
	img.zoomed {
		max-width: none;
		max-height: none;
		border-radius: 0;
	}
	iframe {
		width: 100%;
		height: 70vh;
		border: 0;
		border-radius: 8px;
		background: #fff;
	}
	.error {
		color: var(--error);
	}
</style>
