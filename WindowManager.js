function WindowManager(window_container, window_template, log_enable) {
	// logging function
	this.log = log_enable ? console.log : () => {}

	// the list of windows this WindowManager handles
	this.window_list = []
	
	// callback functions for window manager events
	this.callbacks = {}

	// set this to false to allow windows outside the bounds of the window_container
	this.fix_top_view = true

	// enable snapping of windows to the left/right side
	this.window_snapping = true

	// how close to the border you have to be to snap the window
	this.snap_range = 2

	// window minimum size for resizing any window(can be overwritten by data-max-w/data-max-h attribute)
	this.resize_size_limits = {
		min_w: 300,
		min_h: 200,
	}

	// size limit for newly created windows who's size can be detected in the iframe's onload()
	this.create_size_limits = {
		min_w: 400,
		min_h: 300,
		max_w: window.innerWidth*0.8,
		max_h: window.innerHeight*0.8,
	}

	// trigger a callback function if present
	let trigger_callback = (name, arg) => {
		if (!this.callbacks[name]) { return; }
		return this.callbacks[name](arg)
	}

	// restore the pointerEvents to the focused iframe
	let restore_pointer_events = () => {
		window_container.querySelectorAll(".win-iframe").forEach((e) => {
			e.style.pointerEvents = e.closest(".win").classList.contains("focused") ? "" : "none"
		})
	}

	// Mouse handlers implement window click-focus, dragging and resizing by handling mouse events.
	// Because iframe elements "eat" mouse events for security purposes, you can't
	// get mouse events from the parent window if the click lands in an iframe window.
	// To circumvent problems with moving/resizing/click-focus,
	// only the currently focused window can actually get mouse events,
	// and the other iframes have mouse events disabled.
	let drag_state = undefined
	let resize_state = undefined
	let unmaximize_drag_state = undefined
	this.onmousedown = (e) => {
		let win = e.target.closest(".win")
		if (!win) { return; } // only continue if clicked on a window-related object
		if (e.button !== 0) { return; } // only LMB is relevant here
		this.focus_window(win) // always focus a clicked window
		if (win.classList.contains("maximized")) {
			unmaximize_drag_state = {
				win: win,
				x: e.clientX,
				y: e.clientY,
			}
			// prevent the iframes of all windows from eating mouse pointer events
			window_container.querySelectorAll(".win-iframe").forEach((e) => e.style.pointerEvents = "none")
			e.preventDefault()
			return;
		}

		if (e.target.classList.contains("win-drag-handle")) {
			if (win.classList.contains("fixed-position")) { return; }
			// mouse-down event on a draggable surface of a window, create a drag state
			drag_state = {
				win: win,
				x: e.clientX,
				y: e.clientY
			}
			this.log("window drag start", drag_state)
			
			// prevent the iframes of all windows from eating mouse pointer events
			window_container.querySelectorAll(".win-iframe").forEach((e) => e.style.pointerEvents = "none")
			e.preventDefault()
		} else if (e.target.classList.contains("win-resize-handle")) {
			if (win.classList.contains("fixed-size")) { return; }
			// mouse-down event on a resize element of a resizeable window, create a resize state
			resize_state = {
				win: win,
				x: e.clientX,
				y: e.clientY,
				w: parseInt(win.style.width.substring(0, win.style.width.length-2)),
				h: parseInt(win.style.height.substring(0, win.style.height.length-2)),
			}
			this.log("window resize start", resize_state)

			// prevent the iframes of all windows from eating mouse pointer events
			window_container.querySelectorAll(".win-iframe").forEach((e) => e.style.pointerEvents = "none")
			e.preventDefault()
		}
	}
	this.onmousemove = (e) => {
		if (unmaximize_drag_state) {
			let dist = Math.sqrt(Math.pow(2, e.clientX-unmaximize_drag_state.x)+Math.pow(2, e.clientY-unmaximize_drag_state.y))
			if (dist>50) {
				console.log("unmaximize because of title drag")
				this.restore_window(unmaximize_drag_state.win)
				unmaximize_drag_state.win.style.left = e.clientX + "px"
				unmaximize_drag_state.win.style.top = e.clientY + "px"
				drag_state = {
					win: unmaximize_drag_state.win,
					x: e.clientX,
					y: e.clientY
				}
				unmaximize_drag_state = undefined
			}
		} else if (drag_state) {
			// move the window by calculating the deltas between cursor positions, and applying that to the window
			drag_state.dx = e.clientX - drag_state.x
			drag_state.dy = e.clientY - drag_state.y
			let left = parseInt(drag_state.win.style.left.substring(0, drag_state.win.style.left.length-2))
			let top = parseInt(drag_state.win.style.top.substring(0, drag_state.win.style.top.length-2))
			let new_x = left + drag_state.dx
			let new_y = top + drag_state.dy
			if (this.fix_top_view) {
				// limit the position of the window to remain visible
				new_x = Math.min(Math.max(new_x, -drag_state.win.clientWidth*0.8), window.innerWidth - drag_state.win.clientWidth*0.2)
				new_y = Math.min(Math.max(new_y, 0), window.innerHeight - drag_state.win.titlebar.clientHeight)
			}
			if (this.window_snapping) {
				// snap the window to the top, left or right
				if ((e.clientY < this.snap_range) || (e.clientX < this.snap_range) || (e.clientX > window.innerWidth-this.snap_range)) {
					if (e.clientX < this.snap_range) {
						drag_state.win.classList.add("snapped-left")
						this.maximize_window(drag_state.win)
						drag_state.win.style.width = "50%"
						drag_state.win.restore_state.x = 0
					} else if (e.clientX > window.innerWidth-this.snap_range) {
						drag_state.win.classList.add("snapped-right")
						let cw = drag_state.win.style.width.substring(0, drag_state.win.style.top.length-2)
						this.maximize_window(drag_state.win)
						drag_state.win.style.left = "50%"
						drag_state.win.style.width = "50%"
						let nx = document.documentElement.clientWidth-cw
						drag_state.win.restore_state.x = nx + "px"
					} else {
						this.maximize_window(drag_state.win)
					}
					this.update_has_maximized_window()
					restore_pointer_events()
					drag_state = undefined
					return;
				}
			}
			drag_state.win.style.left = new_x + "px"
			drag_state.win.style.top = new_y + "px"
			drag_state.x = e.clientX
			drag_state.y = e.clientY
			e.preventDefault()
			trigger_callback("win_move", drag_state)
		} else if (resize_state) {
			// resize the window by calculating the deltas between cursor positions, and applying that to the window
			resize_state.dx = e.clientX - resize_state.x
			resize_state.dy = e.clientY - resize_state.y
			let min_w = resize_state.win.getAttribute("data-min-w") || this.resize_size_limits.min_w
			let min_h = resize_state.win.getAttribute("data-min-h") || this.resize_size_limits.min_h
			let max_w = resize_state.win.getAttribute("data-max-w") || Number.MAX_SAFE_INTEGER || Number.MAX_VALUE
			let max_h = resize_state.win.getAttribute("data-max-h") || Number.MAX_SAFE_INTEGER || Number.MAX_VALUE
			let new_w = Math.min(Math.max(resize_state.w + resize_state.dx, min_w), max_w)
			let new_h = Math.min(Math.max(resize_state.h + resize_state.dy, min_h), max_h)
			resize_state.win.style.width = new_w + "px"
			resize_state.win.style.height = new_h + "px"
			resize_state.w = new_w
			resize_state.h = new_h
			resize_state.x = e.clientX
			resize_state.y = e.clientY
			e.preventDefault()
			trigger_callback("win_resize", resize_state)
		}
	}
	this.onmouseup = (e) => {
		if (e.button !== 0) { return; }
		if (!drag_state && !resize_state) { return; }
		restore_pointer_events()
		this.log("window drag/resize end", drag_state, resize_state)
		drag_state = undefined
		resize_state = undefined
		e.preventDefault()
	}

	// set CSS classes and call callbacks if the status of having a maximized window changes
	this.update_has_maximized_window = () => {
		let has_maximized = false
		window_container.querySelectorAll(".maximized").forEach((e) => {
			if (!(e.classList.contains("minimized") || e.classList.contains("snapped-left") || e.classList.contains("snapped-right"))) { has_maximized = true; }
		})
		let has_class = window_container.classList.contains("has-maximized")
		if (has_maximized && !has_class) {
			window_container.classList.add("has-maximized")
			trigger_callback("wm_has_maximized", true)
		} else if (!has_maximized && has_class) {
			window_container.classList.remove("has-maximized")
			trigger_callback("wm_has_maximized", false)
		}
	}

	// register the mouse event handlers with the specified element
	this.register_mouse_events = (elem) => {
		elem.onmousedown = this.onmousedown
		elem.onmouseup = this.onmouseup
		elem.onmousemove = this.onmousemove
		// emulate mouse events on touches
		// TODO: better touchscreen support
		elem.ontouchstart = (e) => {
			let first_touch = e.targetTouches[0]
			this.onmousedown({
				target: first_touch.target,
				button: 0,
				clientX: first_touch.clientX,
				clientY: first_touch.clientY,
				preventDefault: () => e.preventDefault()
			})
		}
		elem.ontouchmove = (e) => {
			let first_touch = e.targetTouches[0]
			this.onmousemove({
				clientX: first_touch.clientX,
				clientY: first_touch.clientY,
				preventDefault: () => { e.preventDefault() }
			})
		}
		elem.ontouchend = (e) => {
			this.onmouseup({
				button: 0,
				preventDefault: () => { e.preventDefault() }
			})
		}
	}

	// called when window manager gets a message from a window client
	// can be overridden by the win_message callback function
	this.onmessage = (e) => {
		let matching_win = this.window_list.find((w) => w.iframe.contentWindow == e.source)
		if (!matching_win) { console.error("Message from unknown iframe:", e); return; }
		
		// if the callback returns truethy, the message has been handled
		if (trigger_callback("win_message", {win: matching_win, data: e.data})) { return; }

		// handle the command from a WindowClient
		if (e.data.command == "close") {
			wm.remove_window(matching_win, e.data.confirm);
		} else if (e.data.command == "dialog_return") {
			matching_win.parent_win.iframe.contentWindow.postMessage({command: "dialog_return", arg: e.data.arg})
		} else if (e.data.command == "minimize") {
			wm.minimize_window(matching_win)
		} else if (e.data.command == "unminimize") {
			wm.unminimize_window(matching_win)
		} else if (e.data.command == "focus") {
			wm.focus_window(matching_win)
		} else if (e.data.command == "set_enabled") {
			if (e.data.enabled == "true") { matching_win.classList.remove("disabled"); }
			else { matching_win.classList.add("disabled"); }
		} else if (e.data.command == "add_window") {
			let win = wm.add_window(e.data.url, e.data.arg);
			win.parent_win = matching_win
		} else if (e.data.command == "set_fixed_position") {
			if (e.data.fixed == "true") { matching_win.classList.add("fixed-position"); }
			else { matching_win.classList.remove("fixed-position"); }
		} else if (e.data.command == "set_fixed_size") {
			if (e.data.fixed == "true") { matching_win.classList.add("fixed-size"); }
			else { matching_win.classList.remove("fixed-size"); }
		} else if (e.data.command == "set_confirm") {
			if (e.data.requires_confirm == "true") { matching_win.classList.add("close-confirm"); }
			else { matching_win.classList.remove("close-confirm"); }
		} else if (e.data.command == "set_size") {
			matching_win.style.width = e.data.w + "px"
			matching_win.style.height = e.data.h + "px"
		} else if (e.data.command == "set_position") {
			matching_win.style.top = e.data.x + "px"
			matching_win.style.bottom = e.data.y + "px"
		} else if (e.data.command == "set_title") {
			matching_win.title_text.innerText = e.data.title
		} else if (e.data.command == "set_icon") {
			// TODO
		} else {
			console.warn("wm got unhandled message: ", e)
		}
	}

	// register the message handler(get events when an iframe postMessage's it's parent)
	this.register_message_events = () => {
		window.addEventListener("message", this.onmessage)
	}

	// the position a new window will be placed at
	this.place = [100, 100]

	// get and update place position (calculate the next this.place, and return the current this.place)
	this.get_next_place_pos = () => {
		let r = [this.place[0], this.place[1]]
		this.place[0] += 75
		this.place[1] += 75
		this.place[0] %= (window.innerWidth-this.create_size_limits.min_w)
		this.place[1] %= (window.innerHeight-this.create_size_limits.min_h)
		return r
	}

	// create and add a window
	this.add_window = (url, window_arg) => {
		// create a new window HTML element
		let win_elem = window_template.content.cloneNode(true).querySelector(".win")

		// set the starting position/dimension
		let pos = this.get_next_place_pos()
		win_elem.style.left = pos[0] + "px"
		win_elem.style.top = pos[1] + "px"
		win_elem.style.width = this.create_size_limits.min_w + "px"
		win_elem.style.height = this.create_size_limits.min_h + "px"

		// get element references for this window
		win_elem.titlebar = win_elem.querySelector(".win-titlebar")
		win_elem.minimize_btn = win_elem.querySelector(".win-btn-minimize")
		win_elem.maximize_btn = win_elem.querySelector(".win-btn-maximize")
		win_elem.restore_btn = win_elem.querySelector(".win-btn-restore")
		win_elem.close_btn = win_elem.querySelector(".win-btn-close")
		win_elem.title_text = win_elem.querySelector(".win-title")
		win_elem.icon_elem = win_elem.querySelector(".win-icon")

		// add the central iframe to this window
		win_elem.iframe = win_elem.querySelector(".win-iframe")
		win_elem.iframe.onload = (e) => {
			
			// post the received window args to the iframe
			e.target.contentWindow.postMessage({ command: "set_window_arg", arg: window_arg })

			// try to get access to the iframe's document, to get info like the title, and ideal size
			let iframe_doc = undefined
			try {
				iframe_doc = (e.target.contentDocument) ? e.target.contentDocument : e.target.contentWindow.document;
			} catch {
				// Can't get access to the iframe document, return early
				console.warn("Can't get document, cross origin problem? postMessage'ing window args instead!")
				trigger_callback("win_onload", win_elem)
				return
			}
			// we have access to the document, get some info about it
			this.log("iframe onload got document:", iframe_doc)

			// update window title
			win_elem.title_text.innerText = iframe_doc.title

			// update window icon from favicon if present
			let favicon = iframe_doc.querySelector("link[rel=icon]")
			if (favicon) {
				this.log("got favicon URL: ", favicon.href)
				let icon_elem = document.createElement("img")
				icon_elem.width = 16
				icon_elem.height = 16
				icon_elem.src = favicon.href
				icon_elem.classList.add("win-icon")
				win_elem.icon_elem.replaceWith(icon_elem)
				win_elem.icon_elem = icon_elem
			}

			// resize the window to fit the document inside the iframe
			let win_w = parseInt(win_elem.style.width.substring(0, win_elem.style.width.length-2))
			let win_h = parseInt(win_elem.style.height.substring(0, win_elem.style.height.length-2))
			let if_w = win_elem.iframe.clientWidth
			let if_h = win_elem.iframe.clientHeight
			let doc_w = iframe_doc.body.scrollWidth
			let doc_h = iframe_doc.body.scrollHeight
			let border_w = win_w - if_w
			let border_h = win_h - if_h
			let new_w = Math.max(Math.min(doc_w + border_w + 50, this.create_size_limits.max_w), this.create_size_limits.min_w)
			let new_h = Math.max(Math.min(doc_h + border_h + 50, this.create_size_limits.max_h), this.create_size_limits.min_h)
			new_w = iframe_doc.body.getAttribute("data-preferred-window-width") || new_w
			new_h = iframe_doc.body.getAttribute("data-preferred-window-height") || new_h
			this.log("got initial window dimensions: ", new_w, new_h)
			win_elem.style.width = new_w + "px"
			win_elem.style.height = new_h + "px"

			// trigger win_onload callback if present
			trigger_callback("win_onload", win_elem)
		}
		win_elem.iframe.src = url

		// handle double-click on titlebar to maximize
		win_elem.titlebar.ondblclick = (e) => {
			let win = e.target.closest(".win")
			if (win.classList.contains("maximized")) {
				this.restore_window(win)
			} else {
				this.maximize_window(win)
			}
		}

		// add to list of active windows
		this.window_list.push(win_elem)
		window_container.appendChild(win_elem)
		this.focus_window(win_elem)
		trigger_callback("win_add", win_elem)

		// return created window
		return win_elem
	}

	// maximize a window(store size/position in restore state, and make window fill entire window_container)
	this.maximize_window = (win_elem) => {
		if (win_elem.classList.contains("fixed-size") || win_elem.classList.contains("fixed-position")) { return; }
		if (win_elem.classList.contains("maximized")) { return; }
		this.log("maximize", win_elem)
		win_elem.classList.add("maximized")
		win_elem.restore_state = {
			w: win_elem.style.width,
			h: win_elem.style.height,
			x: win_elem.style.left,
			y: win_elem.style.top,
		}
		win_elem.style.width = "auto"
		win_elem.style.height = "auto"
		win_elem.style.left = "0px"
		win_elem.style.top = "0px"
		win_elem.style.bottom = "0px"
		win_elem.style.right = "0px"
		this.update_has_maximized_window()
		trigger_callback("win_maximize", win_elem)
	}

	// restore a window to it's original size and position after it has been maximized
	this.restore_window = (win_elem) => {
		if (!win_elem.classList.contains("maximized")) { return; }
		this.log("restore", win_elem)
		win_elem.classList.remove("maximized")
		win_elem.classList.remove("snapped-left")
		win_elem.classList.remove("snapped-right")
		win_elem.style.width = win_elem.restore_state.w
		win_elem.style.height = win_elem.restore_state.h
		win_elem.style.left = win_elem.restore_state.x
		win_elem.style.top = win_elem.restore_state.y
		win_elem.style.bottom = ""
		win_elem.style.right = ""
		win_elem.restore_state = undefined
		this.update_has_maximized_window()
		trigger_callback("win_restore", win_elem)
	}

	// minimize(hide) the window
	this.minimize_window = (win_elem) => {
		this.log("minimize", win_elem)
		win_elem.classList.add("minimized")
		win_elem.classList.remove("focused")
		win_elem.style.display = "none"
		this.update_has_maximized_window()
		trigger_callback("win_minimize", win_elem)
	}
	
	// unminimize(show after minimize) a window
	this.unminimize_window = (win_elem) => {
		this.log("unminimize", win_elem)
		win_elem.classList.remove("minimized")
		win_elem.style.display = ""
		this.focus_window(win_elem)
		this.update_has_maximized_window()
		trigger_callback("win_unminimize", win_elem)
	}

	// focus this window
	this.focus_window = (win_elem) => {
		if (!win_elem) { win_elem = this.window_list[this.window_list.length-1]}
		if (!win_elem) { return; }
		if (win_elem.classList.contains("focused")) { return; }
		this.log("focus_window", win_elem)
		//win_elem.iframe.focus()
		this.window_list.forEach((e) => {
			e.classList.remove("focused")
			e.iframe.style.pointerEvents = "none"
		})
		win_elem.classList.add("focused")
		win_elem.iframe.style.pointerEvents = ""
		this.window_list.push(...this.window_list.splice(this.window_list.indexOf(win_elem), 1))
		// update the z-index of each window from the index in the window_list
		this.window_list.forEach((e,i) => e.style.zIndex = 100+i*10)	
		win_elem.iframe.focus()
		trigger_callback("win_focus", win_elem)
	}

	// remove a window
	this.remove_window = (win_elem, force) => {
		if (win_elem.classList.contains("close-confirm") && !force) {
			this.log("Sending close confirmation request to window")
			win_elem.iframe.contentWindow.postMessage({command: "close_confirm"})
			return;
		}
		this.log("removing window", win_elem, force)
		this.window_list.splice(this.window_list.indexOf(win_elem), 1)
		win_elem.remove()
		if (win_elem.classList.contains("focused") && (this.window_list.length > 0)) {
			this.focus_window(this.window_list[this.window_list.length - 1])
		}
		this.update_has_maximized_window()
		trigger_callback("win_remove", win_elem)
	}
}
