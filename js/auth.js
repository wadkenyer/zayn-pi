import state from './state.js';
import { db, doc, getDoc } from './firebase.js';
import { showToast } from './ui.js';

window.initPi = async () => {
  try {
    await Pi.init({ version: "2.0", sandbox: true });

    const auth = await Pi.authenticate(['username', 'payments'], {
      onIncompletePaymentFound: async (payment) => {
        try {
          const txid = payment.transaction?.txid;
          if (txid) {
            // Payment reached blockchain but server never confirmed — confirm now
            const meta     = payment.metadata || {};
            const dateTime = meta.dateTime || '';
            const [date, time] = dateTime.split(' ');

            if (meta.salonId && meta.service && date && time) {
              // Attempt full recovery: complete + create booking record
              await fetch('/api/create-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  paymentId:   payment.identifier,
                  txid,
                  salonId:     meta.salonId,
                  serviceName: meta.service,
                  date,
                  time,
                  userId:      meta.userId || payment.user_uid || 'unknown'
                })
              });
            } else {
              // Fallback: just confirm with Pi to unblock future payments
              await fetch('/api/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: payment.identifier, txid })
              });
            }
          } else {
            // Not yet on blockchain — re-approve so user can retry
            await fetch('/api/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId: payment.identifier })
            });
          }
        } catch(e) {}
      }
    });

    state.currentUser = auth.user;

    const badge = `<div class="user-badge"><i class="fas fa-circle" style="color:var(--gold);font-size:8px"></i> ${state.currentUser.username}</div>`;
    document.getElementById('auth-area').innerHTML = badge;
    document.getElementById('profile-name').textContent   = state.currentUser.username;
    document.getElementById('profile-status').textContent = '✓ متصل بـ Pi Network';
    document.getElementById('profile-login-btn').style.display = 'none';

    try {
      const salonSnap = await getDoc(doc(db, "salons", state.currentUser.username));
      if (salonSnap.exists()) {
        state.isOwner       = true;
        state.ownerSalonData = salonSnap.data();
        state.ownerServices  = state.ownerSalonData.services || [];
      }
    } catch(e) {}

    showToast(`مرحباً ${state.currentUser.username}!`);
    if (window.loadBookings) window.loadBookings();

  } catch(e) {
    showToast('افتح التطبيق داخل Pi Browser');
  }
};
