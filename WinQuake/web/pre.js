// Emscripten --pre-js of the Bliss web build (MODULARIZE + EXPORT_ES6, factory `createQuake`).
// `Module` here is the object the host passed to createQuake({...}). Contract: Doc/web.md.
//
// - Data directory (`Module.blissDataDir`, default "/data"): `<dataDir>/id1` is created before the
//   host's preRun callbacks run, so they can FS.writeFile('/data/id1/pak0.pak', bytes); it becomes
//   the working directory (Quake basedir "."). The three Qwasm .cfg files are embedded there.
// - Resolution: `Module.blissWidth` x `Module.blissHeight` (default 640x480) is the software
//   renderer's framebuffer and the canvas' width/height attributes; the host scales the canvas
//   with CSS (`image-rendering: pixelated` keeps the original look).
// - Canvas: made focusable, keyboard input only while it has focus (SDL keyboard element),
//   no context menu (right mouse button is bound), pointer lock on click (mouse look),
//   held keys are released when it loses focus.
// - Saves/config are kept in IndexedDB (IDBFS at /qwasm, upstream Qwasm behaviour).
// - Resumes the SDL2 AudioContext on the first user gesture (autoplay policy).
(function () {
  var dataDir = Module['blissDataDir'] || '/data';
  Module['blissDataDir'] = dataDir;

  var w = Module['blissWidth'] | 0, h = Module['blissHeight'] | 0;
  if (w < 320 || h < 200) { w = 640; h = 480; }
  var args = Module['arguments'] || [];
  if (args.indexOf('-winsize') < 0 && args.indexOf('-width') < 0)
    args = ['-winsize', String(w), String(h)].concat(args);
  Module['arguments'] = args;

  var preRun = Module['preRun'] || [];
  if (typeof preRun === 'function') preRun = [preRun];
  preRun.unshift(function () {
    // SDL addresses the canvas as "#canvas" (window + keyboard element); map it to the host's
    // canvas element whatever its id is.
    if (typeof specialHTMLTargets !== 'undefined' && Module['canvas'])
      specialHTMLTargets['#canvas'] = Module['canvas'];
    FS.mkdirTree(dataDir + '/id1');
  });
  // After the host put the files in place.
  preRun.push(function () { FS.chdir(dataDir); });
  Module['preRun'] = preRun;

  // ---- hooks called by the engine (upstream Qwasm names) -----------------------------------
  Module['hideConsole'] = function () {};   // engine finished restoring IDBFS, first frame next
  Module['showConsole'] = function () {};   // Host_Shutdown (quit / fatal error)
  Module['setGamma'] = function () {};      // GL build only
  Module['exportFile'] = function () {};    // demo recording export: not offered
  // Called when a game starts from the menu: lock the pointer if this is a user gesture.
  Module['captureMouse'] = function () { lockPointer(); };

  function lockPointer() {
    var canvas = Module['canvas'];
    if (!canvas || Module['blissPointerLock'] === false) return;
    if (typeof document === 'undefined' || document.pointerLockElement === canvas) return;
    if (Module['_bliss_is_paused'] && Module['_bliss_is_paused']()) return;
    try {
      var p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(function () { /* not a user gesture */ });
    } catch (e) { /* ignore */ }
  }

  Module['blissOnEventInternal'] = function (type) {
    if (type === 'started') Module['blissStarted'] = true;
  };

  function setupCanvas() {
    var canvas = Module['canvas'];
    if (!canvas || canvas.__blissSetup) return;
    canvas.__blissSetup = true;
    if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('pointerdown', function () { canvas.focus({ preventScroll: true }); });
    canvas.addEventListener('click', lockPointer);
    canvas.addEventListener('blur', function () {
      if (Module['_bliss_clear_keys'] && Module['blissStarted']) Module['_bliss_clear_keys']();
    });
  }
  setupCanvas();

  function resumeAudio() {
    var sdl2 = Module['SDL2'];
    var ctx = sdl2 && sdl2.audioContext;
    if (ctx && ctx.state !== 'running' && !(Module['_bliss_is_paused'] && Module['_bliss_is_paused']()))
      ctx.resume();
  }
  if (typeof window !== 'undefined') {
    ['keydown', 'pointerdown', 'touchstart'].forEach(function (type) {
      window.addEventListener(type, resumeAudio, { capture: true, passive: true });
    });
  }
})();
