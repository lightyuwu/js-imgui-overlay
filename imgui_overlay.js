
(async () => {
	// ============================================
	// Configuration
	// ============================================

	const VERSION = "3.0.0";
	const LIBRARY = "https://esm.sh/@mori2003/jsimgui@0.14.0";

	// ============================================
	// Logging
	// ============================================

	const log = (message) => console.log(
		"%cImOverlay%c" + message,
		"background-color: #4296FA; padding: 0px 5px; color: white; border-radius: 5px 0px 0px 5px;",
		"background-color: #0F0F0FF0; padding: 0px 5px; color: white; border-radius: 0px 5px 5px 0px;"
	);

	// ============================================
	// Instance management
	// ============================================

	if (window.__imguiOverlay) {
		window.__imguiOverlay.destroy();
	}

	log(`Initializing v${VERSION}...`);

	const { ImGui, ImGuiImplWeb } = await import(LIBRARY);

	// ============================================
	// Canvas
	// ============================================

	const canvas = document.createElement("canvas");

	canvas.id = "__imgui_overlay";
	canvas.tabIndex = -1;

	Object.assign(canvas.style, {
		position: "fixed",
		inset: "0",
		width: "100vw",
		height: "100vh",
		zIndex: "2147483647",
		pointerEvents: "none",
		background: "transparent",
		display: "block"
	});

	document.documentElement.appendChild(canvas);

	try {
		await ImGuiImplWeb.Init({
			canvas,
			backend: "webgl2"
		});
	} catch (error) {
		canvas.remove();
		throw error;
	}

	// ============================================
	// State
	// ============================================

	const io = ImGui.GetIO();

	let running = true;
	let enabled = true;
	let frame = 0;
	let animationFrame = 0;
	let renderCallback = null;

	const capturedButtons = new Set();

	// ============================================
	// Enable / Disable
	// ============================================

	function setEnabled(value) {
		value = Boolean(value);

		if (enabled === value)
			return;

		enabled = value;

		if (!enabled) {
			// Release any currently captured buttons.
			for (const button of capturedButtons) {
				io.AddMouseButtonEvent(button, false);
			}

			capturedButtons.clear();

			// Move mouse outside ImGui.
			io.AddMousePosEvent(-1, -1);
		}

		canvas.style.display = enabled ? "block" : "none";

		log(`Overlay ${enabled ? "enabled" : "disabled"}.`);
	}

	function toggle() {
		setEnabled(!enabled);
	}

	// ============================================
	// Input handling
	// ============================================

	function mousePosition(event) {
		io.AddMousePosEvent(
			event.clientX,
			event.clientY
		);
	}

	function shouldCaptureMouse() {
		return enabled && (
			io.WantCaptureMouse ||
			capturedButtons.size > 0
		);
	}

	function consume(event) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	function onPointerMove(event) {
		if (!enabled)
			return;

		mousePosition(event);
	}

	function onPointerDown(event) {
		if (!enabled)
			return;

		mousePosition(event);

		if (!shouldCaptureMouse())
			return;

		consume(event);

		capturedButtons.add(event.button);

		io.AddMouseButtonEvent(event.button, true);
	}

	function onPointerUp(event) {
		if (!enabled || !capturedButtons.has(event.button))
			return;

		mousePosition(event);
		consume(event);

		capturedButtons.delete(event.button);

		io.AddMouseButtonEvent(event.button, false);
	}

	function onPointerCancel() {
		for (const button of capturedButtons) {
			io.AddMouseButtonEvent(button, false);
		}

		capturedButtons.clear();
	}

	function onWheel(event) {
		if (!shouldCaptureMouse())
			return;

		consume(event);

		const multiplier = event.deltaMode === 1
			? 0.1
			: event.deltaMode === 2
				? 1
				: 0.01;

		io.AddMouseWheelEvent(
			-event.deltaX * multiplier,
			-event.deltaY * multiplier
		);
	}

	// ============================================
	// Keyboard handling
	// ============================================

	function onKeyDown(event) {
		if (event.code !== "Insert" || event.repeat)
			return;

		consume(event);
		toggle();
	}

	// ============================================
	// Event registration
	// ============================================

	window.addEventListener("pointermove", onPointerMove, true);
	window.addEventListener("pointerdown", onPointerDown, true);
	window.addEventListener("pointerup", onPointerUp, true);
	window.addEventListener("pointercancel", onPointerCancel, true);

	window.addEventListener("wheel", onWheel, {
		capture: true,
		passive: false
	});

	window.addEventListener("keydown", onKeyDown, true);

	// ============================================
	// Rendering
	// ============================================

	function render() {
		if (!running)
			return;

		if (enabled) {
			const dpr = window.devicePixelRatio || 1;

			const width = Math.round(window.innerWidth * dpr);
			const height = Math.round(window.innerHeight * dpr);

			if (canvas.width !== width)
				canvas.width = width;

			if (canvas.height !== height)
				canvas.height = height;

			ImGuiImplWeb.BeginRender();

			// Built-in demo window.
			// ImGui.ShowDemoWindow();

			// Custom render callback.
			if (renderCallback) {
				try {
					renderCallback(ImGui);
				} catch (error) {
					log(`Render callback error: ${error}`);
				}
			}

			ImGuiImplWeb.EndRender();

			frame++;
		}

		animationFrame = requestAnimationFrame(render);
	}

	// ============================================
	// Public API
	// ============================================

	const api = {
		ImGui,
		canvas,
		log,

		get io() {
			return io;
		},

		get frame() {
			return frame;
		},

		get enabled() {
			return enabled;
		},

		get onRender() {
			return renderCallback;
		},

		set onRender(callback) {
			if (callback !== null && typeof callback !== "function")
				throw new TypeError("Expected a function or null");

			renderCallback = callback;
		},

		toggle,
		setEnabled,

		destroy() {
			if (!running)
				return;

			running = false;

			cancelAnimationFrame(animationFrame);

			for (const button of capturedButtons) {
				io.AddMouseButtonEvent(button, false);
			}

			capturedButtons.clear();

			window.removeEventListener("pointermove", onPointerMove, true);
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("pointerup", onPointerUp, true);
			window.removeEventListener("pointercancel", onPointerCancel, true);
			window.removeEventListener("wheel", onWheel, true);
			window.removeEventListener("keydown", onKeyDown, true);

			canvas.remove();

			delete window.__imguiOverlay;

			log("Overlay destroyed.");
		}
	};

	window.__imguiOverlay = api;

	// ============================================
	// Start
	// ============================================

	animationFrame = requestAnimationFrame(render);

	log("Initialized!");
	log("Press INSERT to toggle.");
	log("API: window.__imguiOverlay");
})();
