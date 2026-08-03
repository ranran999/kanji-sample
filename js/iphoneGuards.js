// iOS Safari has ignored the `user-scalable=no` viewport hint since iOS 10
// (for accessibility reasons), so pinch-zoom and double-tap-zoom must also
// be blocked at the event level to keep the app usable full-screen while a
// child is writing with a finger/stylus.
export function installIphoneGuards() {
  const preventDefault = (e) => e.preventDefault();

  // WebKit-only pinch-zoom gesture events.
  document.addEventListener('gesturestart', preventDefault, { passive: false });
  document.addEventListener('gesturechange', preventDefault, { passive: false });
  document.addEventListener('gestureend', preventDefault, { passive: false });

  // Double-tap-to-zoom.
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // Trackpad pinch-zoom (ctrl+wheel) on browsers that map it that way.
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
}
