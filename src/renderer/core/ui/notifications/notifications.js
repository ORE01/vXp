let activeNotifications = 0;

export function showNotification(message, type = 'success', duration = 2500) {
  if (!message) return;

  const el = document.createElement('div');

  el.className = `notification notification-${type}`;
  el.textContent = message;

  const offset = 20 + activeNotifications * 70;

  el.style.bottom = `${offset}px`;

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('visible');
  });

  activeNotifications++;

  setTimeout(() => {
    el.classList.remove('visible');

    setTimeout(() => {
      el.remove();
      activeNotifications = Math.max(0, activeNotifications - 1);
    }, 250);
  }, duration);
}

export function showSuccess(message, duration) {
  showNotification(message, 'success', duration);
}

export function showError(message, duration) {
  showNotification(message, 'error', duration);
}

export function showInfo(message, duration) {
  showNotification(message, 'info', duration);
}