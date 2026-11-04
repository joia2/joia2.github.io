// UI state shared between the top bar menu and the page.
// view: 'home' | 'names' | 'apartment' | 'egenkapital' | 'password'
// rawOpen: the popup with loan.json as plain text
// earlier, later: whether the months collapsed before and after the visible ones are shown
export const ui = $state({ menuOpen: false, view: 'home', rawOpen: false, earlier: false, later: false });
