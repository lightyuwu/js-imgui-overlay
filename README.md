# ImOverlay

A lightweight, browser-wide [Dear ImGui](https://github.com/ocornut/imgui) overlay powered by JavaScript.

ImOverlay allows you to create native-looking ImGui windows directly on top of browser pages, without modifying their HTML structure.

## Features

- **Dear ImGui:** Powered by `@mori2003/jsimgui`.
- **Global overlay:** Renders above the current webpage.
- **Mouse input:** Routes mouse events to ImGui.
- **Page passthrough:** Allows interaction with the webpage outside ImGui.
- **Visibility toggle:** Press `INSERT` to enable or disable the overlay.
- **Render callback:** Register your own ImGui rendering function.
- **Load listeners:** Get notified when ImOverlay finishes initializing.
- **Promise support:** Await initialization using `ImOverlayReady`.
- **Styled logging:** Consistent console messages.
- **Cleanup:** Remove the overlay and its event listeners using `destroy()`.

## Installation

### Tampermonkey

Create a new userscript and include ImOverlay through `@require`.

```javascript
// ==UserScript==
// @name         My ImOverlay Script
// @namespace    my.scripts
// @version      1.0.0
// @description  My custom ImGui overlay
// @match        *://*/*
// @require      https://raw.githubusercontent.com/lightyuwu/js-imgui-overlay/refs/heads/main/imgui_overlay.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

onImGuiLoaded((overlay) => {
    overlay.log("My script is ready!");
});
```

### DevTools

You can also load the library directly through DevTools:

```javascript
await import("https://raw.githubusercontent.com/USERNAME/ImOverlay/main/ImOverlay.js");
```

Since initialization is asynchronous, use `ImOverlayReady` or `onImGuiLoaded()` to wait for it.

## Basic Usage

### Registering a render callback

```javascript
onImGuiLoaded((overlay) => {
    overlay.onRender = (ImGui) => {
        ImGui.Begin("My Window");

        ImGui.Text("Hello from ImOverlay!");

        if (ImGui.Button("Click me!")) {
            overlay.log("Button clicked!");
        }

        ImGui.End();
    };
});
```

The render callback is invoked every frame while the overlay is enabled.

### Waiting with Promises

Alternatively, use the readiness Promise:

```javascript
const overlay = await ImOverlayReady;

overlay.onRender = (ImGui) => {
    ImGui.Begin("My Window");
    ImGui.Text("Hello!");
    ImGui.End();
};
```

### Load listeners

Register a callback to be notified when ImOverlay is initialized:

```javascript
const unsubscribe = onImGuiLoaded((overlay) => {
    console.log("ImOverlay is ready!", overlay);
});
```

Callbacks registered before initialization are executed once initialization finishes.

Callbacks registered after initialization are executed immediately in a microtask.

The function returns an unsubscribe function:

```javascript
const unsubscribe = onImGuiLoaded((overlay) => {
    overlay.log("Ready!");
});

// Prevent the callback from executing.
unsubscribe();
```

### Initialization errors

You can listen for initialization failures:

```javascript
onImGuiLoadError((error) => {
    console.error("ImOverlay failed to initialize:", error);
});
```

You can also catch errors through the Promise:

```javascript
try {
    const overlay = await ImOverlayReady;
} catch (error) {
    console.error(error);
}
```

## API Reference

The global instance is available through:

```javascript
window.__imguiOverlay
```

### Properties

| Property | Description |
|---|---|
| `version` | Current ImOverlay version |
| `ImGui` | Dear ImGui namespace |
| `canvas` | Overlay canvas element |
| `io` | Dear ImGui IO instance |
| `frame` | Number of rendered frames |
| `enabled` | Whether the overlay is enabled |
| `onRender` | Custom render callback |

### Methods

| Method | Description |
|---|---|
| `toggle()` | Toggle overlay visibility |
| `setEnabled(value)` | Enable or disable the overlay |
| `destroy()` | Stop rendering and remove the overlay |
| `log(message)` | Print a styled console message |

### Global functions

| Function | Description |
|---|---|
| `onImGuiLoaded(callback)` | Register an initialization callback |
| `onImGuiLoadError(callback)` | Register an initialization error callback |

### Global Promise

| Promise | Description |
|---|---|
| `ImOverlayReady` | Resolves with the initialized overlay API |

## Examples

### Toggle visibility

```javascript
const overlay = window.__imguiOverlay;

overlay.setEnabled(false);
overlay.setEnabled(true);
overlay.toggle();
```

### Custom rendering

```javascript
onImGuiLoaded((overlay) => {
    overlay.onRender = (ImGui) => {
        ImGui.Begin("Debug Menu");

        ImGui.Text("ImOverlay is running!");

        ImGui.Separator();

        ImGui.Text(`Frames: ${overlay.frame}`);

        ImGui.End();
    };
});
```

### Multiple windows

```javascript
onImGuiLoaded((overlay) => {
    overlay.onRender = (ImGui) => {
        ImGui.Begin("Window A");
        ImGui.Text("First window");
        ImGui.End();

        ImGui.Begin("Window B");
        ImGui.Text("Second window");
        ImGui.End();
    };
});
```

### Cleanup

```javascript
window.__imguiOverlay.destroy();
```

This removes the canvas, unregisters the event listeners, and stops the rendering loop.

## Dependencies

- [jsimgui](https://github.com/mori2003/jsimgui) — JavaScript Dear ImGui bindings.
- WebGL2 — Rendering backend.
- Modern browser with ES module support.

The jsimgui dependency is loaded dynamically from esm.sh.

## Limitations

- The overlay is scoped to the current browser document.
- Page navigation and reloads require reinitialization.
- Some websites may have restrictive Content Security Policies.
- Mouse input capture depends on ImGui's mouse-capture state.
- Keyboard input is currently limited to the overlay toggle shortcut.
- Rendering is paused while the overlay is disabled.

## License

See the repository's LICENSE file for licensing information.
