function WindowClient(wm_window) {
	// simple functions for requesting a function from the "parent" window manager via postMessage
	this.add_window =   (url,arg) => wm_window.postMessage({command: "add_window", url: url, arg: arg})
	this.close =              (c) => wm_window.postMessage({command: "close", confirm: c})
	this.focus =               () => wm_window.postMessage({command: "focus"})
	this.maximize =            () => wm_window.postMessage({command: "maximize"})
	this.minimize =            () => wm_window.postMessage({command: "minimize"})
	this.unminimize =          () => wm_window.postMessage({command: "unminimize"})
	this.restore =             () => wm_window.postMessage({command: "restore"})
	this.set_fixed_position = (f) => wm_window.postMessage({command: "set_fixed_position", fixed: f})
	this.set_fixed_size =     (f) => wm_window.postMessage({command: "set_fixed_size", fixed: f})
	this.set_enabled =        (e) => wm_window.postMessage({command: "set_enabled", enabled: e})
	this.set_confirm =       (c) => wm_window.postMessage({command: "set_confirm", requires_confirm:c})
	this.set_size =        (w,h) => wm_window.postMessage({command: "set_size", w: w, h: h})
	this.set_position =    (x,y) => wm_window.postMessage({command: "set_position", x: x, y: y})
	this.set_title =         (t) => wm_window.postMessage({command: "set_title", title: t})
	this.set_icon =          (i) => wm_window.postMessage({command: "set_icon", icon: i})
	this.return_dialog =   (arg) => wm_window.postMessage({command: "dialog_return", arg: arg})
	this.broadcast =         (d) => wm_window.postMessage({command: "broadcast", arg: d})

	// trigger a callback function if present
	this.callbacks = { broadcast_event: {} }
	let trigger_callback = (name, arg) => {
		if (!this.callbacks[name]) { return; }
		return this.callbacks[name](arg)
	}

	// holds the arguments sent by the add_window function
	this.window_arg = undefined

	// register the message handler for this iframe
	this.register_message_handler = () => {
		window.addEventListener("message", (e) => {
			if (trigger_callback("wm_message", e.data)) {
				// the callback has handled the message
				return
			} else if (e.data.command == "set_window_arg") {
				// the window arguments have been set
				this.window_arg = e.data.arg
				trigger_callback("window_arg", e.data.arg)
			} else if (e.data.command == "dialog_return") {
				// a child window has returned
				this.set_enabled("true")
				trigger_callback("dialog_return", e.data.arg)
			} else if (e.data.command == "close_confirm") {
				// the window requires confirmation to close
				if (!trigger_callback("close_confirm")) {
					this.close("true")
				}
			} else if (e.data.command == "broadcast") {
				// got generic data broadcast
				trigger_callback("broadcast", e.data.arg)
				if (e.data.arg.event && this.callbacks.broadcast_event[e.data.arg.event]) {
					console.log("broadcast cb:")
					this.callbacks.broadcast_event[e.data.arg.event](e.data.arg.arg)
				}
			} else {
				console.warn("Window got unknown message: ", e)
			}
		})
	}

	// add a new window, and call callback when this window returns a value
	this.add_dialog = (url, arg, return_cb) => {
		if (return_cb) {
			this.callbacks.dialog_return = return_cb
		}
		this.set_enabled("false")
		this.add_window(url, arg)
	}
}
