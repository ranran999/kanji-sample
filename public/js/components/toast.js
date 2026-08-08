export function createToast(container) {
  container.classList.add('toast', 'hidden');
  let hideTimer = null;
  let leaveTimer = null;

  function show(message) {
    if (hideTimer) clearTimeout(hideTimer);
    if (leaveTimer) clearTimeout(leaveTimer);

    container.textContent = message;
    container.classList.remove('hidden', 'is-leaving');
    // Restart the entrance transition even if a toast is already showing.
    void container.offsetWidth;
    container.classList.add('is-visible');

    hideTimer = setTimeout(() => {
      container.classList.remove('is-visible');
      container.classList.add('is-leaving');
      leaveTimer = setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('is-leaving');
      }, 250);
    }, 1800);
  }

  return { show };
}
