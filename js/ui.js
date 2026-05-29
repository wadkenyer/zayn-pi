// VULN-09 fix: HTML-escape user-controlled data before injecting into innerHTML
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

export function openModal(id) {
  document.getElementById(id).classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function switchPage(pageId, navId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navId) {
    const el = document.getElementById(navId);
    if (el) el.classList.add('active');
  }

  // Use window ref to avoid circular import with my-bookings.js
  if (pageId === 'bookings-page' && window.loadBookings) window.loadBookings();
}

// Expose to inline onclick handlers
window.openModal   = openModal;
window.closeModal  = closeModal;
window.switchPage  = switchPage;
window.showToast   = showToast;
window.escapeHtml  = escapeHtml;

// Close modals on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
});
