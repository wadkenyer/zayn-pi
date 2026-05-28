import state from './state.js';
import { db, collection, doc, getDocs, updateDoc, query, where, orderBy } from './firebase.js';
import { showToast } from './ui.js';

async function loadBookings() {
  const list = document.getElementById('my-bookings-list');
  if (!state.currentUser) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>سجّل دخولك لرؤية حجوزاتك</p></div>`;
    return;
  }
  list.innerHTML = `<div class="spinner"><i class="fas fa-circle-notch fa-spin"></i></div>`;

  try {
    const q = query(
      collection(db, "bookings"),
      where("user", "==", state.currentUser.username),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>لا توجد حجوزات بعد</p></div>`;
      return;
    }

    let totalPi = 0, count = 0, html = '';

    for (const docSnap of snap.docs) {
      const b      = docSnap.data();
      const docId  = docSnap.id;
      count++;
      totalPi += b.servicePrice || 0;

      const isWomen     = b.gender === 'women';
      const isCancelled = b.status === 'cancelled';
      const isRejected  = b.status === 'rejected';
      const hoursLeft   = (new Date(b.dateTime) - new Date()) / (1000 * 60 * 60);
      const canCancel   = !isCancelled && !isRejected && hoursLeft > 0;
      const showCode    = !isCancelled && !isRejected && b.status !== 'checkedin';

      let checkInCode = b.checkInCode;
      if (!checkInCode && showCode) {
        const arr = new Uint32Array(1); crypto.getRandomValues(arr);
        checkInCode = String(100000 + (arr[0] % 900000));
        try { await updateDoc(doc(db, "bookings", docId), { checkInCode }); } catch(e) {}
      }

      let refundHint = '';
      if (canCancel) {
        if (hoursLeft >= 24)     refundHint = '↩️ استرداد كامل عند الإلغاء';
        else if (hoursLeft >= 2) refundHint = '⚠️ استرداد 50% عند الإلغاء';
        else                     refundHint = '❌ لا استرداد (أقل من ساعتين)';
      }

      const statusLabel = b.status === 'accepted'   ? 'مقبول ✓'    :
                          isCancelled               ? 'ملغي ✗'     :
                          b.status === 'checkedin'  ? 'حضر 📍'     :
                          b.status === 'completed'  ? 'مكتمل ✓'   :
                          isRejected                ? 'مرفوض ✗'   : 'قيد الانتظار ⏳';

      const statusClass = (isCancelled || isRejected)                                  ? 'status-cancelled' :
                          (b.status === 'accepted' || b.status === 'completed' || b.status === 'checkedin') ? 'status-confirmed' :
                          'status-pending';

      html += `
        <div class="booking-card ${isWomen ? 'booking-card-women' : ''}" id="booking-${docId}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:900;font-size:16px;">${b.salon || b.salonName || '—'}</div>
              <div style="color:var(--gray);font-size:13px;margin-top:2px;">
                <i class="fas fa-scissors"></i> ${b.service || b.serviceName || 'خدمة'} · ${b.city || b.salonCity || '—'}
              </div>
            </div>
            <span class="booking-status ${statusClass}">${statusLabel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <div style="color:var(--teal);font-weight:700;font-size:14px;">
              <i class="fas fa-calendar"></i> ${b.dateTime || b.date || 'غير محدد'}
            </div>
            <div style="font-weight:900;font-size:16px;">${b.total || b.amount || 0} Pi</div>
          </div>
          ${refundHint ? `<div style="font-size:12px;color:var(--gray);margin-top:6px;">${refundHint}</div>` : ''}
          ${showCode && checkInCode ? `
          <div style="margin-top:12px;background:linear-gradient(135deg,var(--dark),#1a2f42);border-radius:14px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:8px;">🔑 كود الحضور — أعطه لصاحب الصالون عند وصولك</div>
            <div style="font-size:36px;font-weight:900;color:var(--teal);letter-spacing:10px;line-height:1;">${checkInCode}</div>
          </div>` : ''}
          <div style="font-size:11px;color:#bbb;margin-top:8px;">
            TX: ${b.txid ? b.txid.substring(0,16) : 'sandbox'}...
          </div>
          ${canCancel ? `
          <button onclick="cancelBooking('${docId}','${b.dateTime}',${b.total || b.amount})"
            style="margin-top:12px;width:100%;padding:10px;border:2px solid #ef4444;border-radius:12px;
            background:transparent;color:#ef4444;font-family:'Cairo',sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
            إلغاء الحجز
          </button>` : ''}
          ${(b.status === 'checkedin' || b.status === 'completed') && !b.isReviewed ? `
          <button class="review-btn" onclick="openReviewModal('${docId}','${(b.salon||b.salonName||'').replace(/'/g,"\\'")}','${(b.service||b.serviceName||'').replace(/'/g,"\\'")}','${b.salonId||''}')">
            ⭐ قيّم تجربتك
          </button>` : ''}
          ${b.isReviewed ? `<div class="review-done">✅ شكراً على تقييمك!</div>` : ''}
        </div>`;
    }

    list.innerHTML = html;
    document.getElementById('stat-bookings').textContent = count;
    document.getElementById('stat-pi').textContent       = totalPi.toFixed(1);
    document.getElementById('stat-points').textContent   = count * 10;

    const pct = Math.min((count % 10) * 10, 100);
    document.getElementById('loyalty-bar').style.width = pct + '%';
    const remaining = 10 - (count % 10);
    document.getElementById('loyalty-hint').textContent =
      remaining === 10 ? '🎉 تهانينا! تم ربح 0.5 Pi' : `${remaining} حجوزات متبقية للحصول على 0.5 Pi`;

  } catch(e) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ في التحميل</p></div>`;
  }
}

window.cancelBooking = async (bookingId, dateTime, amount) => {
  try {
    const res = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, user: state.currentUser.username, bookingDateTime: dateTime, amount })
    });
    const data = await res.json();
    if (!data.success) return showToast('خطأ في الإلغاء');

    const confirmed = confirm(`${data.message}\n\nهل تريد المتابعة؟`);
    if (!confirmed) return;

    await updateDoc(doc(db, "bookings", bookingId), {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      refundPolicy: data.refundPolicy,
      refundAmount: parseFloat(data.refundAmount)
    });

    showToast(data.refundPolicy === 'no_refund'
      ? '🚫 تم الإلغاء — لا استرداد'
      : `✅ تم الإلغاء — سيتم استرداد ${data.refundAmount} Pi`
    );

    const card = document.getElementById(`booking-${bookingId}`);
    if (card) {
      card.style.opacity = '0.5';
      card.querySelector('button') && (card.querySelector('button').style.display = 'none');
      card.querySelector('.booking-status').textContent  = 'ملغي ✗';
      card.querySelector('.booking-status').className    = 'booking-status status-cancelled';
    }
  } catch(e) {
    showToast('خطأ — تحقق من الاتصال');
  }
};

// Expose for switchPage and auth
window.loadBookings = loadBookings;
export { loadBookings };
