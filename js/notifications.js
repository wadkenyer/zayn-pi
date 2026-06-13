// Notifications module — exports only, zero top-level side effects
import { db, collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from './firebase.js';
import { escapeHtml } from './ui.js';

let _unsubscribe = null;

export function initNotifications(userId) {
  if (_unsubscribe) _unsubscribe();

  const q = query(
    collection(db, 'notifications'),
    where('to', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(30)
  );

  _unsubscribe = onSnapshot(q, snap => {
    let unread = 0;
    const list = [];
    snap.forEach(d => {
      const n = { id: d.id, ...d.data() };
      if (!n.isRead) unread++;
      list.push(n);
    });
    _updateBadge(unread);
    _renderList(list);
  }, err => {
    console.error('notifications listener:', err.message);
  });
}

function _updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function _renderList(list) {
  const el = document.getElementById('notifications-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><p>لا إشعارات</p></div>`;
    return;
  }
  const icons = { new_booking: '📅', booking_accepted: '✅', booking_rejected: '❌', booking_cancelled: '🚫' };
  el.innerHTML = list.map(n => `
    <div class="notif-item${n.isRead ? '' : ' notif-unread'}" onclick="markNotifRead('${escapeHtml(n.id)}',this)">
      <div class="notif-icon">${icons[n.type] || '🔔'}</div>
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(n.title || '')}</div>
        <div class="notif-msg">${escapeHtml(n.body || '')}</div>
        <div class="notif-time">${_formatTime(n.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function _formatTime(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `منذ ${Math.max(1, Math.floor(diff / 60000))} دقيقة`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
    return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

window.markNotifRead = async (notifId, el) => {
  if (!el || !el.classList.contains('notif-unread')) return;
  try {
    await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
    el.classList.remove('notif-unread');
  } catch {}
};
