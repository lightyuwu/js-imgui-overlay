
(function () {
	"use strict";

	// ============================================
	// Shared loader state
	// ============================================

	const state = window.__imOverlayState ??= {
		api: null,
		loading: false,
		listeners: new Set(),
		errorListeners: new Set(),
		error: null
	};

	// ============================================
	// External load listeners
	// ============================================

	window.onImGuiLoaded = function (handler) {
		if (typeof handler !== "function")
			throw new TypeError("Expected a function");

		if (state.api) {
			queueMicrotask(() => {
				try {
					handler(state.api);
				} catch (error) {
					console.error("[ImOverlay] Load listener error:", error);
				}
			});

			return () => {};
		}

		state.listeners.add(handler);

		return () => state.listeners.delete(handler);
	};

	window.onImGuiLoadError = function (handler) {
		if (typeof handler !== "function")
			throw new TypeError("Expected a function");

		if (state.error) {
			queueMicrotask(() => handler(state.error));
			return () => {};
		}

		state.errorListeners.add(handler);

		return () => state.errorListeners.delete(handler);
	};

	// ============================================
	// Configuration
	// ============================================

	const VERSION = "3.1.0";
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
	// Initialization
	// ============================================

	async function initialize() {
		if (state.loading) {
			log("Already initializing.");
			return;
		}

		if (window.__imguiOverlay) {
			window.__imguiOverlay.destroy();
		}

		state.api = null;
		state.error = null;
		state.loading = true;

		let resolveReady;
		let rejectReady;

		const readyPromise = new Promise((resolve, reject) => {
			resolveReady = resolve;
			rejectReady = reject;
		});

		// Avoid unhandled rejection warnings if nobody
		// is currently awaiting the readiness promise.
		readyPromise.catch(() => {});

		window.ImOverlayReady = readyPromise;

		log(`Initializing v${VERSION}...`);

		let canvas = null;

		try {
			// ========================================
			// Load dependency
			// ========================================

			const { ImGui, ImGuiImplWeb } = await import(LIBRARY);

			// ========================================
			// Canvas
			// ========================================

			canvas = document.createElement("canvas");

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

			await ImGuiImplWeb.Init({
				canvas,
				backend: "webgl2"
			});

			// ========================================
			// State
			// ========================================

			const io = ImGui.GetIO();

			let running = true;
			let enabled = true;
			let frame = 0;
			let animationFrame = 0;
			let renderCallback = null;

			const capturedButtons = new Set();

			// ========================================
			// Enable / Disable
			// ========================================

			function setEnabled(value) {
				value = Boolean(value);

				if (enabled === value)
					return;

				enabled = value;

				if (!enabled) {
					for (const button of capturedButtons) {
						io.AddMouseButtonEvent(button, false);
					}

					capturedButtons.clear();
					io.AddMousePosEvent(-1, -1);
				}

				canvas.style.display = enabled ? "block" : "none";

				log(`Overlay ${enabled ? "enabled" : "disabled"}.`);
			}

			function toggle() {
				setEnabled(!enabled);
			}

			// ========================================
			// Input handling
			// ========================================

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

			// ========================================
			// Keyboard handling
			// ========================================

			function onKeyDown(event) {
				if (event.code !== "Insert" || event.repeat)
					return;

				consume(event);
				toggle();
			}

			// ========================================
			// Event registration
			// ========================================

			window.addEventListener("pointermove", onPointerMove, true);
			window.addEventListener("pointerdown", onPointerDown, true);
			window.addEventListener("pointerup", onPointerUp, true);
			window.addEventListener("pointercancel", onPointerCancel, true);

			window.addEventListener("wheel", onWheel, {
				capture: true,
				passive: false
			});

			window.addEventListener("keydown", onKeyDown, true);

			// ========================================
			// Rendering
			// ========================================

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
							console.error(error);
						}
					}

					ImGuiImplWeb.EndRender();

					frame++;
				}

				animationFrame = requestAnimationFrame(render);
			}

			// ========================================
			// Public API
			// ========================================

			const api = {
				version: VERSION,
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

					if (window.__imguiOverlay === api) {
						delete window.__imguiOverlay;
					}

					if (state.api === api) {
						state.api = null;
					}

					log("Overlay destroyed.");
				}
			};

			// ========================================
			// Publish API
			// ========================================

			window.__imguiOverlay = api;

			state.api = api;
			state.loading = false;

			// Start rendering.
			animationFrame = requestAnimationFrame(render);

			log("Initialized!");
			log("Press INSERT to toggle.");
			log("API: window.__imguiOverlay");

			// ========================================
			// Notify listeners
			// ========================================

			for (const handler of state.listeners) {
				try {
					handler(api);
				} catch (error) {
					log("Load listener error.");
					console.error(error);
				}
			}

			state.listeners.clear();

			window.dispatchEvent(
				new CustomEvent("imoverlay:loaded", {
					detail: api
				})
			);

			resolveReady(api);

			return api;

		} catch (error) {
			if (canvas)
				canvas.remove();

			state.loading = false;
			state.api = null;
			state.error = error;

			log("Initialization failed.");
			console.error(error);

			for (const handler of state.errorListeners) {
				try {
					handler(error);
				} catch (listenerError) {
					console.error("[ImOverlay] Error listener failed:", listenerError);
				}
			}

			rejectReady(error);

			throw error;
		}
	}

	// ============================================
	// Start initialization
	// ============================================

	initialize().catch(() => {});
})();
