<script>
	// One of the two faces from the logo: cyan for person A, mint for person B
	let { person, size = 56 } = $props();
</script>

<svg class="face" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
	<circle cx="20" cy="20" r="17.5" fill={person === 'cyan' ? '#22d3ee' : '#2dd4bf'} />
	<g fill="none" stroke="#0b2a2e" stroke-width="2.5" stroke-linecap="round">
		<circle cx="20" cy="20" r="17.5" />
		<path d="M11.5 23.5q8.5 7.5 17 0" />
	</g>
	<circle cx="14" cy="16" r="2.3" fill="#0b2a2e" />
	<circle cx="26" cy="16" r="2.3" fill="#0b2a2e" />
</svg>
