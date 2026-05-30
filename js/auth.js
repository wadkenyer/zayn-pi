import state from './state.js';
import { db, doc, getDoc } from './firebase.js';
import { showToast } from './ui.js';

// Initialize Pi SDK once — modules run after DOM is ready so this is safe
if (typeof Pi !== 'undefined') {
  try {
    Pi.init({ version: "2.0", sandbox: false });
  } catch(e) {
    console.warn('Pi.init failed:', e);
  }
}

window.initPi = async () => {
  // Pi SDK not available — app is not running inside Pi Browser
  if (typeof Pi === 'undefined') {
    showToast('يرجى فتح التطبيق داخل Pi Browser');
    return;
  }

  try {
    const auth = await Pi.authenticate(
      ['username', 'payments'],
      async (payment) => {
        // onIncompletePaymentFound: clear pending payment to unblock new ones
        try {
          const txid = payment.transaction?.txid;
          if (txid) {
            await fetch('/api/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId: payment.identifier, txid })
            });
          } else {
            await fetch('/api/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId: payment.identifier })
            });
          }
        } catch(e) {}
      }
    );

    state.currentUser = auth.user;
    state.accessToken = auth.accessToken;

    const badge = `<div class="user-badge"><i class="fas fa-circle" style="color:var(--gold);font-size:8px"></i> ${state.currentUser.username}</div>`;
    document.getElementById('auth-area').innerHTML = badge;
    document.getElementById('profile-name').textContent   = state.currentUser.username;
    document.getElementById('profile-status').textContent = '✓ متصل بـ Pi Network';
    document.getElementById('profile-login-btn').style.display = 'none';

    try {
      const salonSnap = await getDoc(doc(db, "salons", state.currentUser.username));
      if (salonSnap.exists()) {
        state.isOwner        = true;
        state.ownerSalonData = salonSnap.data();
        state.ownerServices  = state.ownerSalonData.services || [];
      }
    } catch(e) {}

    showToast(`مرحباً ${state.currentUser.username}!`);
    if (window.loadBookings) window.loadBookings();

  } catch(e) {
    console.error('Pi.authenticate error:', e);
    // Show the real error to help diagnose in Pi Browser console
    const msg = e?.message || e?.toString() || 'unknown error';
    showToast(`خطأ في تسجيل الدخول: ${msg}`);
  }
};
