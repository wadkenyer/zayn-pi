import state from './state.js';
import { showToast, openModal, closeModal, switchPage } from './ui.js';

export function generateTimeSlots(isWomen, openTime, closeTime) {
  const container = document.getElementById('time-slots');
  container.innerHTML = '';
  const parseHour = t => t ? parseInt(t.split(':')[0]) : null;
  const startH = parseHour(openTime) || 9;
  const endH   = parseHour(closeTime) || 21;

  for (let h = startH; h <= endH; h++) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    const btn = document.createElement('button');
    btn.className = 'time-btn';
    btn.textContent = timeStr;
    btn.onclick = () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected', 'selected-women'));
      btn.classList.add(isWomen ? 'selected-women' : 'selected');
      state.selectedTime = timeStr;
      if (state.selectedService) updateSummary();
    };
    container.appendChild(btn);
  }
}

function updateSummary() {
  const total = (state.selectedService.price + 0.1).toFixed(1);
  document.getElementById('booking-total').textContent = `${total} Pi`;
  document.getElementById('booking-summary').style.display = 'block';
}

window.openBookingModal = (salonOrId) => {
  const salon = (typeof salonOrId === 'string')
    ? (window._salonMap && window._salonMap[salonOrId])
    : salonOrId;

  if (!salon) { showToast('تعذّر تحميل بيانات الصالون'); return; }
  if (!state.currentUser) { showToast('سجّل دخولك أولاً بـ Pi'); return; }
  if (!salon.available) { showToast('🔴 الصالون مشغول الآن'); return; }
  if (!salon.services || salon.services.length === 0) {
    showToast('لا توجد خدمات متاحة في هذا الصالون'); return;
  }

  state.selectedSalon   = salon;
  state.selectedService = null;
  state.selectedTime    = null;

  const isWomen = salon.gender === 'women';
  document.getElementById('modal-salon-name').textContent = `حجز في ${salon.name}`;
  document.getElementById('booking-summary').style.display = 'none';

  const confirmBtn = document.getElementById('confirm-btn-main');
  if (confirmBtn) confirmBtn.disabled = false;

  const svcsEl = document.getElementById('modal-services');
  svcsEl.innerHTML = salon.services.map((sv, i) => `
    <div class="service-option" id="svc-opt-${i}" onclick="selectService(${i})">
      <div>
        <div class="service-name">${sv.name}</div>
        <div class="service-duration"><i class="fas fa-clock"></i> ${sv.duration} دقيقة</div>
      </div>
      <div class="service-price ${isWomen ? 'service-price-women' : ''}">${sv.price} Pi</div>
    </div>
  `).join('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('booking-date');
  dateInput.value = tomorrow.toISOString().split('T')[0];
  dateInput.min   = tomorrow.toISOString().split('T')[0];

  generateTimeSlots(isWomen, salon.openTime, salon.closeTime);
  openModal('booking-modal');
};

window.selectService = (idx) => {
  if (!state.selectedSalon) return;
  const sv = state.selectedSalon.services[idx];
  if (!sv) return;
  state.selectedService = { idx, price: sv.price, name: sv.name, duration: sv.duration };

  const isWomen = state.selectedSalon.gender === 'women';
  document.querySelectorAll('.service-option').forEach(el => el.classList.remove('selected', 'selected-women'));
  document.getElementById(`svc-opt-${idx}`).classList.add(isWomen ? 'selected-women' : 'selected');

  if (state.selectedTime) updateSummary();
};

window.confirmBooking = async () => {
  if (!state.selectedService) return showToast('اختر الخدمة أولاً');
  if (!state.selectedTime)    return showToast('اختر وقت الحجز');

  const date = document.getElementById('booking-date').value;
  if (!date) return showToast('اختر التاريخ');

  const confirmBtn = document.getElementById('confirm-btn-main');
  if (confirmBtn) confirmBtn.disabled = true;

  const total         = +(state.selectedService.price + 0.1).toFixed(1);
  const fullDateTime  = `${date} ${state.selectedTime}`;

  try {
    const paymentData = {
      amount: total,
      memo: `حجز ${state.selectedSalon.name} - ${state.selectedService.name} - ${fullDateTime}`,
      metadata: {
        salon:      state.selectedSalon.name,
        salonId:    state.selectedSalon.id,
        service:    state.selectedService.name,
        dateTime:   fullDateTime,
        commission: 0.1,
        userId:     state.currentUser.username
      }
    };

    await Pi.createPayment(paymentData, {
      onReadyForServerApproval: async (paymentId) => {
        try {
          const r = await fetch('/api/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId })
          });
          if (!r.ok) {
            const d = await r.json().catch(() => ({}));
            showToast(`⚠️ فشل الموافقة على الدفع (${r.status}): ${d.error || ''}`);
          }
        } catch(e) {
          showToast('⚠️ خطأ في الاتصال أثناء الموافقة على الدفع');
        }
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        try {
          const res = await fetch('/api/create-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId,
              txid,
              salonId:     state.selectedSalon.id,
              serviceName: state.selectedService.name,
              date,
              time:        state.selectedTime,
              userId:      state.currentUser.username
            })
          });

          const data = await res.json();

          if (!res.ok) {
            const msg = data.code === 'SLOT_TAKEN'
              ? '❌ هذا الوقت محجوز — تم الدفع، تواصل مع الدعم'
              : '❌ خطأ في إتمام الحجز، تواصل مع الدعم';
            showToast(msg);
            if (confirmBtn) confirmBtn.disabled = false;
            return;
          }

          closeModal('booking-modal');
          showToast('✅ تم الحجز — ينتظر قبول الصالون');
          switchPage('bookings-page', 'nav-bookings');
          if (window.loadBookings) window.loadBookings();
        } catch(e) {
          showToast('❌ خطأ في الاتصال، تواصل مع الدعم');
          if (confirmBtn) confirmBtn.disabled = false;
        }
      },
      onCancel: (payment, error) => {
        showToast('تم إلغاء الدفع');
        if (confirmBtn) confirmBtn.disabled = false;
      },
      onError: (error, payment) => {
        console.error('Pi payment error:', error, payment);
        showToast(`❌ خطأ Pi: ${error?.message || JSON.stringify(error) || 'غير معروف'}`);
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  } catch(e) {
    showToast('حدث خطأ، تأكد من Pi Browser');
    if (confirmBtn) confirmBtn.disabled = false;
  }
};
