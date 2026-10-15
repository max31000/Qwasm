# Bliss web build (Quake, software renderer)

Branch `bliss-web` of the max31000/Qwasm mirror (upstream: GMH-Code/Qwasm, id Software Quake
GPL source, WinQuake software renderer + SDL2). Single player, fully client-side, no pthreads
(no COOP/COEP needed), main loop on `requestAnimationFrame` (`emscripten_set_main_loop`).
Release asset `quake-web-X.Y.Z.tgz` (tag `web-vX.Y.Z`): `quake.js` (ES module), `quake.wasm`,
`LICENSE` (GPL-2.0), this file. No game data.

## Build

    emcmake cmake -S . -B build-web -G Ninja -DCMAKE_BUILD_TYPE=Release
    cmake --build build-web          # -> build-web/bin/quake.{js,wasm}

Emscripten 6.0.10 (CI: `emscripten/emsdk:6.0.10` pinned by digest). The upstream
`WinQuake/Makefile.emscripten` (standalone page) is unchanged.

## Host usage

```js
import createQuake from './quake.js';
const pak = new Uint8Array(await (await fetch(pakUrl)).arrayBuffer()); // id1/pak0.pak (shareware 1.06)
const M = await createQuake({
  canvas,                                  // HTMLCanvasElement
  locateFile: (name) => wasmUrl,           // for quake.wasm
  blissWidth: 640, blissHeight: 480,       // framebuffer (default 640x480, min 320x200)
  preRun: [(m) => m.FS.writeFile('/data/id1/pak0.pak', pak)],
  onBlissEvent(type, json) { /* see below */ },
  // optional: blissDataDir ('/data'), blissPointerLock (false = never lock),
  //           blissAutoPause (default true: pause while the tab is hidden), arguments ([...])
});
```

The canvas' `width`/`height` attributes are set to the framebuffer size; size it with CSS
(4:3, `image-rendering: pixelated` keeps the software-renderer look). `<dataDir>/id1` exists
before the host's `preRun` runs; `<dataDir>` becomes the working directory. The Qwasm key
defaults are id Software's own: `quake.rc` runs `default.cfg` from pak0.pak (original key
bindings: arrows move/turn, Ctrl fire, Alt strafe, Shift run, Space/Enter jump, `/` next weapon,
F-keys as in DOS; gamma 1.0, sensitivity 3), then the saved `config.cfg`, then the embedded
`web/autoexec.cfg` (`+mlook`: mouse look on). Qwasm's WASD `config.cfg`/`wasm.cfg` are not used.

## Events (`onBlissEvent(type, json)`)

| type | json |
|---|---|
| `started` | `{"width":640,"height":480}` after the first frame |
| `pauseChanged` | `{"paused":true|false}` (host API pause/resume) |
| `quit` | `{}` the player confirmed Quit in the game menu (or `_bliss_quit()`); the module is disposed |
| `error` | `{"message":"..."}` fatal engine error (e.g. missing pak0.pak); followed by shutdown |

## Exports

| function | |
|---|---|
| `_bliss_pause()` / `_bliss_resume()` / `_bliss_is_paused()` | stops/restarts the main loop and SDL audio, releases held keys; pause also exits pointer lock. Automatic while the tab is hidden unless `blissAutoPause: false` (resumes only what it paused) |
| `_bliss_dispose()` | releases everything: cancels the main loop, `Host_Shutdown` (writes config, closes audio, `SDL_Quit` removes SDL's DOM listeners), aborts every pre.js listener (one AbortController), exits pointer lock, closes the AudioContext. Idempotent, works while paused; the module is unusable afterwards (all exports become no-ops) — create a new one with `createQuake` |
| `_bliss_quit()` | like the in-game Quit: dispose + `quit` event; works while paused |
| `_bliss_set_master_volume(0..100)` / `_bliss_get_master_volume()` | host volume on top of the in-game volume slider |
| `_bliss_set_mouse_sensitivity(float)` / `_bliss_get_mouse_sensitivity()` | Quake `sensitivity` cvar (menu range 1..11, default 4) |
| `_bliss_new_game(skill 0..3)` | `map start` (like Single Player -> New Game) |
| `ccall('bliss_command', null, ['string'], [line])` | console command line (see trust model) |
| `_bliss_clear_keys()` | releases held keys (called automatically on canvas blur) |
| `_bliss_pointer_lock_lost()` | opens the game menu if playing and not host-paused (web/pre-mouse.js calls it when the browser released the pointer lock without an Esc key event) |

## Input

Keyboard is only read while the canvas has focus (`SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT`,
text input stopped). Click on the canvas focuses it and requests pointer lock (mouse look).
Mouse movement and buttons reach the game only while the canvas holds the lock (the click
that requests it is not a shot; moving the cursor over an unlocked canvas does nothing).
Esc releases the lock (the browser does not pass that key press to the page) and the build then
opens the game menu (web/pre-mouse.js), as Esc does. Right click is bound (+forward), so the context menu is
suppressed. A host that pauses the game should release the lock itself (`exitPointerLock`).

## `bliss_command` trust model

The line goes straight into Quake's command buffer with full console rights (`map`, `bind`,
`exec`, `writeconfig`, cvars, `quit`, ...). Only pass host-authored constants; never pass text
from URLs, user input, other frames or the network. The reach is limited to the module itself
(MEMFS/IDBFS `/bliss-quake`, no network, no DOM), but a crafted line can break or wipe the
player's saved config/saves.

## Persistence, audio

Saves (`save`/`load` menu) and `config.cfg` are written to `/bliss-quake/id1` and synced to
IndexedDB (IDBFS mount `/bliss-quake`; upstream Qwasm used `/qwasm`). The SDL2 AudioContext is resumed on the first user
gesture. Sound effects only: the shareware music was CD audio and is not available
(`cd_null.c`).
