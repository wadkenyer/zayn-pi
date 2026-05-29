import state, { apiHeaders } from './state.js';
import { showToast, escapeHtml } from './ui.js';

async function loadBookings() {
  const list = document.getElementById('my-bookings-list');
  if (!state.currentUser) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>سجّل دخولك لرؤية حجوزاتك</p></div>`;
    return;
  }
  list.innerHTML = `<div class="spinner"><i class="fas fa-circle-notch fa-spin"></i></div>`;

  try {
    // VULN-02 fix: username is now derived server-side from the Bearer token
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('loadBookings API error:', err);
      list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ في التحميل (${res.status})</p></div>`;
      return;
    }

    const { bookings } = await res.json();

    if (!bookings || bookings.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>لا توجد حجوزات بعد</p></div>`;
      return;
    }

    let totalPi = 0, count = 0, html = '';

    for (const b of bookings) {
      const docId = b.id;
      count++;
      totalPi += b.servicePrice || 0;

      const isWomen     = b.gender === 'women';
      const isCancelled = b.status === 'cancelled';
      const isRejected  = b.status === 'rejected';
      const hoursLeft   = (new Date(b.dateTime) - new Date()) / (1000 * 60 * 60);
      const canCancel   = !isCancelled && !isRejected && hoursLeft > 0;
      const showCode    = !isCancelled && !isRejected && b.status !== 'checkedin';

      // VULN-21 fix: checkInCode is always generated server-side in create-booking
      const checkInCode = b.checkInCode;

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

      const statusClass = (isCancelled || isRejected)                                                          ? 'status-cancelled' :
                          (b.status === 'accepted' || b.status === 'completed' || b.status === 'checkedin')    ? 'status-confirmed' :
                          'status-pending';

      const safeDocId  = escapeHtml(docId);
      const safeSalon  = escapeHtml(b.salon || b.salonName || '—');
      const safeService = escapeHtml(b.service || b.serviceName || 'خدمة');
      const safeCity   = escapeHtml(b.city || b.salonCity || '—');
      const safeDate   = escapeHtml(b.dateTime || b.date || 'غير محدد');
      const safeTxid   = escapeHtml(b.txid ? b.txid.substring(0, 16) : 'sandbox');
      const safeSalonId = escapeHtml(b.salonId || '');

      html += `
        <div class="booking-card ${isWomen ? 'booking-card-women' : ''}" id="booking-${safeDocId}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:900;font-size:16px;">${safeSalon}</div>
              <div style="color:var(--gray);font-size:13px;margin-top:2px;">
                <i class="fas fa-scissors"></i> ${safeService} · ${safeCity}
              </div>
            </div>
            <span class="booking-status ${statusClass}">${statusLabel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <div style="color:var(--teal);font-weight:700;font-size:14px;">
              <i class="fas fa-calendar"></i> ${safeDate}
            </div>
            <div style="font-weight:900;font-size:16px;">${Number(b.total || b.amount || 0)} Pi</div>
          </div>
          ${refundHint ? `<div style="font-size:12px;color:var(--gray);margin-top:6px;">${refundHint}</div>` : ''}
          ${showCode && checkInCode ? `
          <div style="margin-top:12px;background:linear-gradient(135deg,var(--dark),#1a2f42);border-radius:14px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:8px;">🔑 كود الحضور — أعطه لصاحب الصالون عند وصولك</div>
            <div style="font-size:36px;font-weight:900;color:var(--teal);letter-spacing:10px;line-height:1;">${escapeHtml(checkInCode)}</div>
          </div>` : ''}
          <div style="font-size:11px;color:#bbb;margin-top:8px;">
            TX: ${safeTxid}...
          </div>
          ${canCancel ? `
          <button onclick="cancelBooking('${safeDocId}')"
            style="margin-top:12px;width:100%;padding:10px;border:2px solid #ef4444;border-radius:12px;
            background:transparent;color:#ef4444;font-family:'Cairo',sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
            إلغاء الحجز
          </button>` : ''}
          ${(b.status === 'checkedin' || b.status === 'completed') && !b.isReviewed ? `
          <button class="review-btn" onclick="openReviewModal('${safeDocId}','${safeSalon.replace(/'/g,"\\'")}','${safeService.replace(/'/g,"\\'")}','${safeSalonId}')">
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
    console.error('loadBookings error:', e);
    list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ في الاتصال بالخادم</p></div>`;
  }
}

window.cancelBooking = async (bookingId) => {
  try {
    // Step 1: get refund policy (no write yet)
    const previewRes = await fetch('/api/cancel', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ bookingId, confirm: false })
    });
    const preview = await previewRes.json();
    if (!previewRes.ok || !preview.success) return showToast(preview.error || 'خطأ في الإلغاء');

    const confirmed = confirm(`${preview.message}\n\nهل تريد المتابعة؟`);
    if (!confirmed) return;

    // Step 2: confirm cancellation server-side (VULN-06 fix: no client-side Firestore write)
    const confirmRes = await fetch('/api/cancel', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ bookingId, confirm: true })
    });
    const data = await confirmRes.json();
    if (!confirmRes.ok || !data.success) return showToast(data.error || 'خطأ في الإلغاء');

    showToast(data.refundPolicy === 'no_refund'
      ? '🚫 تم الإلغاء — لا استرداد'
      : `✅ تم الإلغاء — سيتم استرداد ${data.refundAmount} Pi`
    );

    const card = document.getElementById(`booking-${bookingId}`);
    if (card) {
      card.style.opacity = '0.5';
      card.querySelector('button') && (card.querySelector('button').style.display = 'none');
      card.querySelector('.booking-status').textContent = 'ملغي ✗';
      card.querySelector('.booking-status').className   = 'booking-status status-cancelled';
    }
  } catch(e) {
    showToast('خطأ — تحقق من الاتصال');
  }
};

// Expose for switchPage and auth
window.loadBookings = loadBookings;
export { loadBookings };
