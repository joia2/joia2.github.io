// UI state shared between the top bar menu and the page.
// view: 'home' | 'names' | 'apartment' | 'mortgage' | 'password'
// rawOpen: the popup with loan.json as plain text
// saleOpen: the sale calculator popup
// time: the bottom bar's toggle: extras keep the payments and end sooner (a view only, not saved)
// earlier, later: whether the months collapsed before and after the visible ones are shown
export const ui = $state({ menuOpen: false, view: 'home', rawOpen: false, saleOpen: false, earlier: false, later: false, time: false });
