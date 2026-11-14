// The current minute, since 1970: changes on each new minute while the app is open
export const clock = $state({ minute: Math.floor(Date.now() / 60_000) });

if (typeof window !== 'undefined') {
	const tick = () => {
		clock.minute = Math.floor(Date.now() / 60_000);
		setTimeout(tick, 60_000 - (Date.now() % 60_000));
	};
	setTimeout(tick, 60_000 - (Date.now() % 60_000));
}
