// handle clicking a tab: update tab buttons, show/hide tab panels
function tab_onclick(ev) {
	let tab_button = ev.target
	let tab_group = tab_button.getAttribute("data-tabgroup")
	let tab_panel = document.getElementById(tab_button.getAttribute("aria-controls"))
	let _tab_group = tab_group.replace(/["\\]/g, '\\$&')
	let tab_buttons = document.querySelectorAll("[role=tab][data-tabgroup="+_tab_group+"]")
	let tab_panels = document.querySelectorAll("[role=tabpanel][data-tabgroup="+_tab_group+"]")
	for (let c_tab_button of tab_buttons) {
		c_tab_button.setAttribute("aria-selected", "false")
	}
	for (let c_tab_panel of tab_panels) {
		c_tab_panel.setAttribute("hidden", true)
	}
	tab_panel.removeAttribute("hidden")
	tab_button.setAttribute("aria-selected", "true")
}
