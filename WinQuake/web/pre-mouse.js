// Emscripten --pre-js (after pre.js): Esc while the pointer is locked only releases the lock
// (the browser keeps that key press from the page). Open the game menu then, as Esc would
// without the lock (bliss_pointer_lock_lost, vid_sdl.c). Skipped while the host paused the game
// (it released the lock itself), when the tab is hidden, or when an Esc key press did reach the page.
(function () {
  if (typeof document === 'undefined') return;
  var lastEscape = 0, wasLocked = false;
  var on = Module['blissOn'];  // pre.js: addEventListener under the dispose AbortController
  on(window, 'keydown', function (e) {
    if (e.key === 'Escape') lastEscape = Date.now();
  }, { capture: true, passive: true });
  on(document, 'pointerlockchange', function () {
    var canvas = Module['canvas'];
    var locked = !!canvas && document.pointerLockElement === canvas;
    if (wasLocked && !locked) {
      setTimeout(function () {
        if (Date.now() - lastEscape < 400 || !Module['blissStarted'] || document.hidden) return;
        if (Module['blissDisposed']) return;
        if (document.pointerLockElement === canvas) return;
        if (Module['_bliss_is_paused'] && Module['_bliss_is_paused']()) return;
        if (Module['_bliss_pointer_lock_lost']) Module['_bliss_pointer_lock_lost']();
      }, 120);
    }
    wasLocked = locked;
  });
})();
