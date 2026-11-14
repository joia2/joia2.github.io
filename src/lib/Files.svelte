<script>
	import Check from '@lucide/svelte/icons/check';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileText from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import Attachment from '#lib/Attachment.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { upload, MAX_SIZE } from '#lib/attachments.js';
	import { session } from '#lib/session.svelte.js';

	// A list of attached files (PDFs, images) with + attachment and + paste. A new file is named in
	// a small popup, then uploaded encrypted (attachments.js); onchange runs after every upload or
	// removal, for the page to save the list. Tap a file to see it.
	// files: bindable, saved ones { id, name, type }, new ones { name, type, file } while uploading
	// tags: the first word of each name shows as a colored tag
	let { files = $bindable([]), onchange, tags = false } = $props();

	let error = $state('');

	// Listed by name; each keeps its place in `files` for removing
	const listed = $derived(files.map((f, i) => ({ f, i })).sort((a, b) => a.f.name.localeCompare(b.f.name, 'nb')));

	// "Contract signed.pdf" → tag "Contract", name "signed.pdf"; a one-word name is both
	function split(name) {
		const dot = name.lastIndexOf('.');
		const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
		const [tag, ...rest] = base.trim().split(/\s+/);
		return { tag, name: (rest.length ? rest.join(' ') : tag) + ext };
	}
	// A color for each word, always the same one: its hue from the word's letters
	const hue = (word) => [...word.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

	// Returns the entry added, or nothing when the file is too large
	function add(file) {
		if (file.size > MAX_SIZE) return void (error = `${file.name} is too large: the most is ${MAX_SIZE / 1024 / 1024} MB.`);
		files.push({ name: file.name, type: file.type, file });
		return files.at(-1);
	}
	function attach(event) {
		error = '';
		for (const file of event.currentTarget.files) {
			const entry = add(file);
			if (entry) startRename(entry);
		}
		event.currentTarget.value = '';
	}

	const isFile = (type) => type.startsWith('image/') || type === 'application/pdf';
	// What a file really is, from its first bytes, when the clipboard doesn't say (an iPhone can give
	// a PDF from Mail no type at all)
	async function sniff(blob) {
		if (isFile(blob.type)) return blob.type;
		const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
		const text = String.fromCharCode(...b);
		if (text.startsWith('%PDF')) return 'application/pdf';
		if (b[0] === 0x89 && text.slice(1, 4) === 'PNG') return 'image/png';
		if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
		if (text.slice(4, 8) === 'ftyp') return 'image/heic';
		if (/\.pdf$/i.test(blob.name ?? '')) return 'application/pdf';
		return '';
	}
	// A pasted file keeps its own name when it has one (a PDF from Mail), else is named by the time:
	// pasted 2026-11-14 18.05.png
	function addPasted(blob, type) {
		const stamp = new Date().toLocaleString('sv').slice(0, 16).replace(':', '.');
		const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
		const own = blob.name && !/^image\.\w+$/.test(blob.name) ? blob.name : '';
		const entry = add(new File([blob], own || `pasted ${stamp}.${ext}`, { type }));
		if (entry) startRename(entry);
	}
	// Also called by the page for a paste elsewhere (a cost's description)
	export async function paste(event) {
		event.preventDefault();
		error = '';
		const pastedFiles = [...(event.clipboardData?.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
		let found = false;
		for (const f of pastedFiles) {
			const type = await sniff(f);
			if (type) (addPasted(f, type), (found = true));
		}
		if (!found) error = `The clipboard has no image or PDF${pastedFiles.length ? ` (it has: ${pastedFiles.map((f) => f.type || 'no type').join(', ')})` : ''}.`;
	}

	// Right after a file is added or pasted: a small popup to name it, one file after another; the
	// extension stays as it is
	let renaming = $state(null); // { entry, base, ext }
	let renameOpen = $state(false);
	const waiting = []; // files added together, named one after another
	function startRename(entry) {
		if (renameOpen) return void waiting.push(entry);
		const dot = entry.name.lastIndexOf('.');
		renaming = { entry, base: dot > 0 ? entry.name.slice(0, dot) : entry.name, ext: dot > 0 ? entry.name.slice(dot) : '' };
		renameOpen = true;
	}
	function rename(event) {
		event.preventDefault();
		event.stopPropagation(); // the popup sits inside the page's own form: not its submit
		const base = renaming.base.trim();
		if (base) renaming.entry.name = base + renaming.ext;
		renameOpen = false;
	}
	// The focus comes at once, while still in the tap or paste that opened the popup: an iPhone
	// only brings up the keyboard then (or keeps it, when it is already up)
	const selectAll = (input) => {
		const select = () => (input.focus(), input.setSelectionRange(0, input.value.length));
		select();
		requestAnimationFrame(select); // again once the popup is open, which moves the focus to itself
	};
	// Once the popup has closed, named or not: the file is uploaded, and the next one named
	$effect(() => {
		if (renameOpen || !renaming) return;
		const { entry } = renaming;
		renaming = null;
		uploadEntry(entry);
		if (waiting.length) setTimeout(() => startRename(waiting.shift()));
	});
	async function uploadEntry(entry) {
		if (session.demo) return void (error = 'Attachments are not kept in the demo.');
		try {
			const saved = await upload(entry.file, entry.name);
			const i = files.indexOf(entry);
			if (i >= 0) files[i] = saved;
			onchange?.(); // also when the popup around was closed during the upload
		} catch (e) {
			error = `${entry.name} could not be saved: ${e.message}`;
		}
	}
	function removeAt(i) {
		files.splice(i, 1);
		onchange?.();
	}

	let shown = $state(null); // the attachment in the preview
	let previewOpen = $state(false);
	const preview = (f) => ((shown = f), (previewOpen = true));
</script>

{#if files.length}
	<ul class="files">
		{#each listed as { f, i }, n (f.id ?? f.name + i)}
			{@const parts = split(f.name)}
			<li class:uploading={!f.id} title={f.id ? f.name : 'saving…'}>
				<span class="num">{n + 1}</span>
				<button type="button" class="name" onclick={() => preview(f)}>
					{#if f.type?.startsWith('image/')}<ImageIcon size={14} />{:else if f.type === 'application/pdf'}<FileText size={14} />{:else}<FileIcon size={14} />{/if}
					{#if tags}<span class="tag" style:--hue={hue(parts.tag)}>{parts.tag}</span>{/if}
					<span class="text">{tags ? parts.name : f.name}</span>
				</button>
				<button type="button" class="icon-button" onclick={() => removeAt(i)} aria-label="remove {f.name}">
					<X size={16} />
				</button>
			</li>
		{/each}
	</ul>
{/if}
<div class="add">
	<label class="chip">
		<Paperclip size={16} />+ attachment
		<input type="file" accept="application/pdf,image/*" multiple onchange={attach} />
	</label>
	<!-- An empty field to paste a file into with the keyboard's Paste, as in a chat: the system
	     hands it the file. Nothing can be typed into it. -->
	<label class="chip paste">
		<ClipboardPaste size={16} />
		<input
			placeholder="+ paste"
			aria-label="paste an image or PDF"
			autocomplete="off"
			onpaste={paste}
			onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
			onbeforeinput={(e) => e.inputType !== 'insertFromPaste' && e.preventDefault()}
			oninput={(e) => (e.currentTarget.value = '')}
		/>
	</label>
</div>
{#if error}<p class="error" role="alert">{error}</p>{/if}

<Attachment file={shown} bind:open={previewOpen} />

<Sheet title="file name" bind:open={renameOpen}>
	{#if renaming}
		{#key renaming}
			<form class="rename" onsubmit={rename}>
				<span class="field-name">
					<!-- svelte-ignore a11y_autofocus -->
					<input bind:value={renaming.base} aria-label="file name" autocomplete="off" autofocus use:selectAll />
					<span class="ext">{renaming.ext}</span>
				</span>
				<button class="primary" type="submit"><Check size={20} />ok</button>
			</form>
		{/key}
	{/if}
</Sheet>

<style>
	.files {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.files li {
		display: flex;
		align-items: center;
	}
	/* A drawn dot: exactly in the line's middle, unlike the • character */
	.files li::before {
		content: '';
		flex-shrink: 0;
		width: 5px;
		height: 5px;
		margin: 0 0.2rem 0 0.35rem;
		border-radius: 50%;
		background: var(--muted);
	}
	/* Its place in the list, small, right after the dot */
	.num {
		min-width: 0.9em;
		font-size: 0.65rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	/* Not uploaded yet */
	.uploading {
		opacity: 0.55;
	}
	/* The kind's icon (image, PDF, other), the tag and the name, cut with … when too long */
	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.3rem;
		border: 0;
		background: transparent;
		font-size: 0.78rem;
		text-align: left;
	}
	.name :global(svg) {
		flex-shrink: 0;
		color: var(--muted);
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		flex-shrink: 0;
		padding: 0.05rem 0.45rem;
		border-radius: 0.7rem;
		background: hsl(var(--hue) 75% 50% / 0.22);
		color: hsl(var(--hue) 60% 30%);
		white-space: nowrap;
	}
	@media (prefers-color-scheme: dark) {
		.tag {
			color: hsl(var(--hue) 75% 78%);
		}
	}
	.files .icon-button {
		width: 28px;
		height: 28px;
	}
	.add {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.25rem;
	}
	/* The two as small dashed chips; the paste field without a box of its own inside */
	.chip {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		gap: 0.2rem;
		min-width: 0;
		padding: 0.15rem 0.3rem;
		border: 1px dashed var(--border);
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		white-space: nowrap;
		cursor: pointer;
	}
	.chip input[type='file'] {
		display: none;
	}
	.paste input {
		width: 4.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
	}
	.paste input:focus {
		box-shadow: none;
	}
	.paste:focus-within {
		border-color: var(--accent);
	}
	.paste input::placeholder {
		color: inherit;
		opacity: 1;
	}
	.error {
		margin: 0;
		font-size: 0.75rem;
		color: var(--error);
	}
	/* The name popup's form: not the page's card, the popup is the card */
	.rename {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: none;
		margin: 0;
		padding: 0 1.5rem 1.5rem;
		background: none;
		border-radius: 0;
		box-shadow: none;
	}
	.field-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.field-name input {
		flex: 1;
		min-width: 0;
	}
	.ext {
		color: var(--muted);
	}
</style>
