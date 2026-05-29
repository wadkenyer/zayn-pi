import state, { apiHeaders } from './state.js';
import { db, doc, getDoc } from './firebase.js';
import { showToast, openModal, closeModal, switchPage, escapeHtml } from './ui.js';

function renderOwnerServices() {
  const el = document.getElementById('owner-services-list');
  if (!state.ownerServices.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--gray);padding:20px 0;font-size:14px;">أضف خدماتك وأسعارها</div>`;
    return;
  }
  el.innerHTML = state.ownerServices.map((sv, i) => `
    <div class="service-manage-card">
      <div class="service-manage-info">
        <div class="service-manage-name">${escapeHtml(sv.name)}</div>
        <div class="service-manage-details"><i class="fas fa-clock"></i> ${Number(sv.duration)} دقيقة</div>
      </div>
      <div class="service-manage-price">${Number(sv.price)} Pi</div>
      <button onclick="deleteService(${i})" class="delete-service-btn">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

async function loadOwnerDashboard() {
  if (!state.currentUser) return;
  try {
    const salonSnap = await getDoc(doc(db, "salons", state.currentUser.username));
    if (!salonSnap.exists()) return;

    state.ownerSalonData = salonSnap.data();
    state.isOwner        = true;
    state.ownerServices  = state.ownerSalonData.services || [];
    state.salonAvailable = state.ownerSalonData.available !== false;

    document.getElementById('owner-salon-name-header').textContent = state.ownerSalonData.name;
    document.getElementById('edit-salon-name').value  = state.ownerSalonData.name    || '';
    document.getElementById('edit-salon-city').value  = state.ownerSalonData.city    || '';
    document.getElementById('edit-salon-phone').value = state.ownerSalonData.phone   || '';
    document.getElementById('edit-salon-img').value   = state.ownerSalonData.img     || '';
    document.getElementById('edit-salon-desc').value  = state.ownerSalonData.desc    || '';
    if (state.ownerSalonData.openTime)  document.getElementById('edit-open-time').value  = state.ownerSalonData.openTime;
    if (state.ownerSalonData.closeTime) document.getElementById('edit-close-time').value = state.ownerSalonData.closeTime;

    const toggle = document.getElementById('avail-toggle');
    const label  = document.getElementById('avail-label');
    if (state.salonAvailable) { toggle.classList.add('on');    label.textContent = '🟢 متاح الآن'; }
    else                      { toggle.classList.remove('on'); label.textContent = '🔴 مشغول الآن'; }

    renderOwnerServices();

    // Load bookings via server API (bypasses Firestore security rules + index requirements)
    const apiRes = await fetch('/api/owner-bookings', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({})
    });

    if (!apiRes.ok) {
      console.error('owner-bookings API error:', await apiRes.text().catch(() => ''));
      return;
    }

    const { pending, recent, stats } = await apiRes.json();

    // Pending bookings
    let pendingHtml = '';
    (pending || []).forEach(b => {
      const safeId      = escapeHtml(b.id);
      const safeUser    = escapeHtml(b.userId || b.user);
      const safeService = escapeHtml(b.serviceName || b.service || 'خدمة');
      const safeDate    = escapeHtml(b.dateTime || '');
      const safeDeposit = Number(b.depositPaid || b.total || 0);
      pendingHtml += `
        <div class="pending-booking-item" id="pending-${safeId}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:900;font-size:15px;">@${safeUser}</div>
              <div style="font-size:13px;color:var(--gray);margin-top:2px;">
                ✂️ ${safeService} · ${safeDate}
              </div>
              <div style="font-size:12px;color:var(--teal);margin-top:2px;">
                💰 عربون: ${safeDeposit} Pi
              </div>
            </div>
            <span class="status-badge status-pending">⏳ انتظار</span>
          </div>
          <div class="pending-actions">
            <button class="accept-btn" onclick="acceptBooking('${safeId}')">✅ قبول</button>
            <button class="reject-btn" onclick="rejectBooking('${safeId}')">❌ رفض</button>
          </div>
        </div>`;
    });

    const pendingEl = document.getElementById('owner-pending-list');
    if (pendingEl) pendingEl.innerHTML = pendingHtml ||
      `<div style="text-align:center;color:var(--gray);padding:16px 0;font-size:13px;">✓ لا توجد حجوزات معلقة</div>`;

    // Stats
    const { revenue = 0, todayCount = 0, completedCount = 0, pendingCount = 0 } = stats || {};
    document.getElementById('owner-revenue').textContent     = Number(revenue).toFixed(1);
    document.getElementById('owner-revenue-sub').textContent = `↑ ${completedCount} حجوزات مكتملة`;
    document.getElementById('owner-today').textContent       = todayCount;
    document.getElementById('owner-pending').textContent     = pendingCount;
    document.getElementById('owner-commission').innerHTML    =
      `${(completedCount * 0.1).toFixed(1)} <span style="font-size:12px;color:var(--teal);">Pi</span>`;

    // Recent bookings
    let recentHtml = '';
    (recent || []).forEach(b => {
      const safeUser    = escapeHtml(b.userId || b.user);
      const safeService = escapeHtml(b.serviceName || b.service || 'خدمة');
      const safeDate    = escapeHtml(b.dateTime || '');
      recentHtml += `
        <div class="recent-booking-item">
          <div>
            <div class="rb-user">@${safeUser}</div>
            <div class="rb-service">${safeService}</div>
            <div class="rb-time">${safeDate}</div>
          </div>
          <div style="text-align:left;">
            <div class="rb-amount">${Number(b.servicePrice || 0)} Pi</div>
            <span class="status-badge status-${b.status||'pending'}" style="font-size:10px;">${
              b.status === 'completed' ? '✓ مكتمل' :
              b.status === 'accepted'  ? '✓ مقبول' :
              b.status === 'cancelled' ? '✗ ملغي'  :
              b.status === 'checkedin' ? '📍 حضر'   : '⏳ انتظار'
            }</span>
          </div>
        </div>`;
    });

    const recentEl = document.getElementById('owner-recent-bookings') || document.getElementById('owner-recent-list');
    if (recentEl) recentEl.innerHTML = recentHtml ||
      `<div class="empty-state" style="padding:20px 0;"><i class="fas fa-inbox"></i><p>لا حجوزات بعد</p></div>`;

  } catch(e) {
    console.error('loadOwnerDashboard error:', e);
  }
}

window.openOwnerSection = () => {
  if (!state.currentUser) { showToast('سجّل دخولك أولاً بـ Pi'); return; }
  if (state.isOwner && state.ownerSalonData) {
    switchPage('owner-page', null);
    loadOwnerDashboard();
  } else {
    openModal('register-owner-modal');
  }
};

window.goToRegStep2 = () => {
  const name = document.getElementById('reg-salon-name').value.trim();
  const city = document.getElementById('reg-salon-city').value.trim();
  if (!name) return showToast('أدخل اسم الصالون');
  if (!city) return showToast('أدخل المدينة');
  document.getElementById('reg-step-1').style.display = 'none';
  document.getElementById('reg-step-2').style.display = 'block';
  document.getElementById('step-dot-1').style.background = 'var(--teal)';
  document.getElementById('step-dot-2').style.background = 'var(--teal)';
};

window.goToRegStep1 = () => {
  document.getElementById('reg-step-2').style.display = 'none';
  document.getElementById('reg-step-1').style.display = 'block';
  document.getElementById('step-dot-2').style.background = '#e0e0e0';
};

// VULN-08 fix: salon creation is now done server-side in /api/register-salon
window.registerSalon = async () => {
  const name      = document.getElementById('reg-salon-name').value.trim();
  const city      = document.getElementById('reg-salon-city').value.trim();
  const gender    = document.getElementById('reg-salon-gender').value;
  const phone     = document.getElementById('reg-salon-phone').value.trim();
  const imgInput  = document.getElementById('reg-salon-img').value.trim();
  const desc      = document.getElementById('reg-salon-desc').value.trim();
  const openTime  = document.getElementById('reg-open-time').value;
  const closeTime = document.getElementById('reg-close-time').value;

  if (!name || !city) return showToast('أكمل بيانات الصالون');

  try {
    await Pi.createPayment(
      { amount: 2, memo: `تسجيل صالون ${name} على ZAYN PI`, metadata: { type: 'salon_registration', salonName: name, city, gender } },
      {
        onReadyForServerApproval: async (paymentId) => {
          try { await fetch('/api/approve', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ paymentId }) }); } catch(e) {}
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          try {
            const res = await fetch('/api/register-salon', {
              method: 'POST',
              headers: apiHeaders(),
              body: JSON.stringify({ paymentId, txid, name, city, gender, phone, img: imgInput, desc, openTime, closeTime })
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'خطأ في التسجيل'); return; }

            const defaultImg = gender === 'women'
              ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600'
              : 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600';

            state.isOwner        = true;
            state.ownerSalonData = { name, city, gender, img: imgInput || defaultImg, phone, desc, openTime, closeTime, available: true, services: [], revenue: 0 };
            state.ownerServices  = [];

            closeModal('register-owner-modal');
            showToast(`🎉 تم تسجيل ${name} بنجاح!`);
            switchPage('owner-page', null);
            loadOwnerDashboard();
          } catch(e) { showToast('خطأ في إتمام التسجيل'); }
        },
        onCancel: () => showToast('تم إلغاء التسجيل'),
        onError:  () => showToast('خطأ في الدفع')
      }
    );
  } catch(e) {
    showToast('خطأ، تأكد من Pi Browser');
  }
};

window.acceptBooking = async (bookingId) => {
  try {
    const res = await fetch('/api/owner-action', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'accept', bookingId })
    });
    if (!res.ok) { showToast('خطأ في القبول'); return; }
    showToast('✅ تم قبول الحجز');
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ في القبول'); }
};

window.rejectBooking = async (bookingId) => {
  const reason = prompt('سبب الرفض (اختياري):') || 'ظرف طارئ';
  try {
    const res = await fetch('/api/owner-action', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'reject', bookingId, reason })
    });
    if (!res.ok) { showToast('خطأ في الرفض'); return; }
    showToast('تم رفض الحجز');
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ'); }
};

window.verifyCheckIn = async () => {
  const code = document.getElementById('qr-input-field').value.trim();
  if (!/^\d{6}$/.test(code)) return showToast('الكود يجب أن يكون 6 أرقام فقط');
  try {
    const res = await fetch('/api/owner-action', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'checkin', code, bookingId: '_' })
    });
    const data = await res.json();
    if (!res.ok) { showToast(`❌ ${data.error || 'خطأ في التحقق'}`); return; }
    document.getElementById('qr-input-field').value = '';
    showToast(`✅ تم تسجيل حضور @${data.user} — ${data.service}`);
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ في التحقق'); }
};

// VULN-14 fix: all salon writes go through /api/salon-update
window.toggleAvailability = async () => {
  // Optimistic update
  state.salonAvailable = !state.salonAvailable;
  const toggle = document.getElementById('avail-toggle');
  const label  = document.getElementById('avail-label');
  if (state.salonAvailable) { toggle.classList.add('on');    label.textContent = '🟢 متاح الآن'; }
  else                      { toggle.classList.remove('on'); label.textContent = '🔴 مشغول الآن'; }
  try {
    const res = await fetch('/api/salon-update', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'toggle_availability' })
    });
    if (!res.ok) throw new Error();
    showToast(state.salonAvailable ? 'الصالون الآن متاح ✓' : 'تم التحديث: مشغول الآن');
  } catch(e) {
    // Revert on failure
    state.salonAvailable = !state.salonAvailable;
    if (state.salonAvailable) { toggle.classList.add('on');    label.textContent = '🟢 متاح الآن'; }
    else                      { toggle.classList.remove('on'); label.textContent = '🔴 مشغول الآن'; }
    showToast('تحقق من الاتصال');
  }
};

window.updateSalonData = async () => {
  const name      = document.getElementById('edit-salon-name').value.trim();
  const city      = document.getElementById('edit-salon-city').value.trim();
  const phone     = document.getElementById('edit-salon-phone').value.trim();
  const img       = document.getElementById('edit-salon-img').value.trim();
  const desc      = document.getElementById('edit-salon-desc').value.trim();
  const openTime  = document.getElementById('edit-open-time').value;
  const closeTime = document.getElementById('edit-close-time').value;

  const updates = {};
  if (name)      updates.name      = name;
  if (city)      updates.city      = city;
  if (phone)     updates.phone     = phone;
  if (img)       updates.img       = img;
  if (desc)      updates.desc      = desc;
  if (openTime)  updates.openTime  = openTime;
  if (closeTime) updates.closeTime = closeTime;

  if (!Object.keys(updates).length) return showToast('لا يوجد تعديلات للحفظ');
  try {
    const res = await fetch('/api/salon-update', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'update_info', ...updates })
    });
    if (!res.ok) { showToast('خطأ في الحفظ'); return; }
    showToast('✅ تم حفظ التعديلات');
    state.ownerSalonData = { ...state.ownerSalonData, ...updates };
    if (updates.name) document.getElementById('owner-salon-name-header').textContent = updates.name;
  } catch(e) { showToast('خطأ في الحفظ'); }
};

window.openAddServiceModal = () => {
  document.getElementById('svc-name').value     = '';
  document.getElementById('svc-duration').value = '';
  document.getElementById('svc-price').value    = '';
  openModal('add-service-modal');
};

window.saveService = async () => {
  const name     = document.getElementById('svc-name').value.trim();
  const duration = parseInt(document.getElementById('svc-duration').value);
  const price    = parseFloat(document.getElementById('svc-price').value);
  if (!name || !duration || !price) return showToast('أكمل بيانات الخدمة');
  try {
    const res = await fetch('/api/salon-update', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'add_service', name, duration, price })
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'خطأ في الحفظ'); return; }
    const data = await res.json();
    state.ownerServices = data.services;
    closeModal('add-service-modal');
    renderOwnerServices();
    showToast('✓ تم إضافة الخدمة');
  } catch(e) { showToast('خطأ في الحفظ'); }
};

window.deleteService = async (idx) => {
  try {
    const res = await fetch('/api/salon-update', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ action: 'delete_service', serviceIndex: idx })
    });
    if (!res.ok) { showToast('خطأ في الحذف'); return; }
    const data = await res.json();
    state.ownerServices = data.services;
    renderOwnerServices();
    showToast('تم حذف الخدمة');
  } catch(e) { showToast('خطأ'); }
};
