// UI state shared between the top bar menu and the page.
// view: 'home' | 'names' | 'apartment' | 'costs' | 'password'
// the popups: rawOpen (data.json as plain text), saleOpen, calcOpen (calculations), ownedOpen (what
// each has paid), instalmentOpen, yearsOpen (tax return)
// earlier, later: whether the months collapsed before and after the visible ones are shown
const POPUPS = ['rawOpen', 'saleOpen', 'calcOpen', 'ownedOpen', 'instalmentOpen', 'yearsOpen'];

export const ui = $state({ menuOpen: false, view: 'home', earlier: false, later: false, ...Object.fromEntries(POPUPS.map((k) => [k, false])) });

// Back to the main page, with the menu and every popup closed (a settings page is left unsaved)
export function goHome() {
	ui.menuOpen = false;
	ui.view = 'home';
	for (const k of POPUPS) ui[k] = false;
}
