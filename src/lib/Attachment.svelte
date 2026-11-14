<script>
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Download from '@lucide/svelte/icons/download';
	import Sheet from '#lib/Sheet.svelte';
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
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	});
</script>

<Sheet title={file?.name ?? ''} bind:open>
	{#snippet actions()}
		{#if url}
			<a class="icon-button" href={url} download={file.name} aria-label="download"><Download size={22} /></a>
		{/if}
	{/snippet}
	<div class="view">
		{#if error}
			<p class="error">{error}</p>
		{:else if !url}
			<LoaderCircle size={24} class="spin" />
		{:else if file.type.startsWith('image/')}
			<img src={url} alt={file.name} />
		{:else}
			<iframe src={url} title={file.name}></iframe>
		{/if}
	</div>
</Sheet>

<style>
	.view {
		display: grid;
		place-items: center;
		min-height: 12rem;
		padding: 0 1rem 1rem;
		overflow: auto;
	}
	img {
		max-width: 100%;
		max-height: 70vh;
		border-radius: 8px;
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
