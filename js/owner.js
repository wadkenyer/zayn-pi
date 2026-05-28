import state from './state.js';
import { db, collection, doc, getDocs, updateDoc, setDoc, getDoc, serverTimestamp, query, where, orderBy, limit } from './firebase.js';
import { showToast, openModal, closeModal, switchPage } from './ui.js';

function renderOwnerServices() {
  const el = document.getElementById('owner-services-list');
  if (!state.ownerServices.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--gray);padding:20px 0;font-size:14px;">أضف خدماتك وأسعارها</div>`;
    return;
  }
  el.innerHTML = state.ownerServices.map((sv, i) => `
    <div class="service-manage-card">
      <div class="service-manage-info">
        <div class="service-manage-name">${sv.name}</div>
        <div class="service-manage-details"><i class="fas fa-clock"></i> ${sv.duration} دقيقة</div>
      </div>
      <div class="service-manage-price">${sv.price} Pi</div>
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

    // Pending bookings
    const pendingSnap = await getDocs(query(
      collection(db, "bookings"),
      where("salonId", "==", state.currentUser.username),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    ));
    let pendingCount = 0, pendingHtml = '';
    pendingSnap.forEach(d => {
      const b = d.data(); pendingCount++;
      pendingHtml += `
        <div class="pending-booking-item" id="pending-${d.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:900;font-size:15px;">@${b.userId || b.user}</div>
              <div style="font-size:13px;color:var(--gray);margin-top:2px;">
                ✂️ ${b.serviceName || b.service || 'خدمة'} · ${b.dateTime || ''}
              </div>
              <div style="font-size:12px;color:var(--teal);margin-top:2px;">
                💰 عربون: ${b.depositPaid || 0.3} Pi
              </div>
            </div>
            <span class="status-badge status-pending">⏳ انتظار</span>
          </div>
          <div class="pending-actions">
            <button class="accept-btn" onclick="acceptBooking('${d.id}','${b.userId||b.user}','${b.serviceName||b.service||''}','${b.dateTime||''}','')">✅ قبول</button>
            <button class="reject-btn" onclick="rejectBooking('${d.id}')">❌ رفض</button>
          </div>
        </div>`;
    });
    const pendingEl = document.getElementById('owner-pending-list');
    if (pendingEl) pendingEl.innerHTML = pendingHtml ||
      `<div style="text-align:center;color:var(--gray);padding:16px 0;font-size:13px;">✓ لا توجد حجوزات معلقة</div>`;

    // All bookings stats
    const bSnap = await getDocs(query(
      collection(db, "bookings"),
      where("salonId", "==", state.currentUser.username),
      orderBy("createdAt", "desc"),
      limit(10)
    ));
    let revenue = 0, todayCount = 0, completedCount = 0, recentHtml = '';
    const today = new Date().toISOString().split('T')[0];
    bSnap.forEach(d => {
      const b = d.data();
      if (b.status === 'completed') { revenue += b.servicePrice || 0; completedCount++; }
      if (b.dateTime && b.dateTime.startsWith(today)) todayCount++;
      recentHtml += `
        <div class="recent-booking-item">
          <div>
            <div class="rb-user">@${b.userId || b.user}</div>
            <div class="rb-service">${b.serviceName || b.service || 'خدمة'}</div>
            <div class="rb-time">${b.dateTime || ''}</div>
          </div>
          <div style="text-align:left;">
            <div class="rb-amount">${b.servicePrice || 0} Pi</div>
            <span class="status-badge status-${b.status||'pending'}" style="font-size:10px;">${
              b.status === 'completed' ? '✓ مكتمل' :
              b.status === 'accepted'  ? '✓ مقبول' :
              b.status === 'cancelled' ? '✗ ملغي'  :
              b.status === 'checkedin' ? '📍 حضر'   : '⏳ انتظار'
            }</span>
          </div>
        </div>`;
    });

    document.getElementById('owner-revenue').textContent     = revenue.toFixed(1);
    document.getElementById('owner-revenue-sub').textContent = `↑ ${completedCount} حجوزات مكتملة`;
    document.getElementById('owner-today').textContent       = todayCount;
    document.getElementById('owner-pending').textContent     = pendingCount;
    document.getElementById('owner-commission').innerHTML    =
      `${(completedCount * 0.1).toFixed(1)} <span style="font-size:12px;color:var(--teal);">Pi</span>`;

    const toggle = document.getElementById('avail-toggle');
    const label  = document.getElementById('avail-label');
    if (state.salonAvailable) { toggle.classList.add('on');    label.textContent = '🟢 متاح الآن'; }
    else                      { toggle.classList.remove('on'); label.textContent = '🔴 مشغول الآن'; }

    renderOwnerServices();

    const recentEl = document.getElementById('owner-recent-bookings') || document.getElementById('owner-recent-list');
    if (recentEl) recentEl.innerHTML = recentHtml ||
      `<div class="empty-state" style="padding:20px 0;"><i class="fas fa-inbox"></i><p>لا حجوزات بعد</p></div>`;

  } catch(e) {
    console.error(e);
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

window.registerSalon = async () => {
  const name      = document.getElementById('reg-salon-name').value.trim();
  const city      = document.getElementById('reg-salon-city').value.trim();
  const gender    = document.getElementById('reg-salon-gender').value;
  const phone     = document.getElementById('reg-salon-phone').value.trim();
  const imgInput  = document.getElementById('reg-salon-img').value.trim();
  const desc      = document.getElementById('reg-salon-desc').value.trim();
  const openTime  = document.getElementById('reg-open-time').value;
  const closeTime = document.getElementById('reg-close-time').value;
  const defaultImg = gender === 'women'
    ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600'
    : 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600';
  const img = imgInput || defaultImg;

  if (!name || !city) return showToast('أكمل بيانات الصالون');

  try {
    await Pi.createPayment(
      { amount: 2, memo: `تسجيل صالون ${name} على ZAYN PI`, metadata: { type: 'salon_registration', salonName: name, city, gender } },
      {
        onReadyForServerApproval: async (paymentId) => {
          try { await fetch('/api/approve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({paymentId}) }); } catch(e) {}
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          try { await fetch('/api/complete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({paymentId, txid}) }); } catch(e) {}

          await setDoc(doc(db, "salons", state.currentUser.username), {
            name, city, gender, img, phone, desc, openTime, closeTime,
            owner: state.currentUser.username,
            available: true, rating: 5.0, reviews: 0, revenue: 0,
            registrationTxid: txid, services: [], createdAt: serverTimestamp()
          });

          state.isOwner        = true;
          state.ownerSalonData = { name, city, gender, img, phone, desc, openTime, closeTime, available: true, services: [], revenue: 0 };
          state.ownerServices  = [];

          closeModal('register-owner-modal');
          showToast(`🎉 تم تسجيل ${name} بنجاح!`);
          switchPage('owner-page', null);
          loadOwnerDashboard();
        },
        onCancel: () => showToast('تم إلغاء التسجيل'),
        onError:  () => showToast('خطأ في الدفع')
      }
    );
  } catch(e) {
    showToast('خطأ، تأكد من Pi Browser');
  }
};

window.acceptBooking = async (bookingId, userId, serviceName, dateTime, userPhone) => {
  try {
    await updateDoc(doc(db, "bookings", bookingId), { status: 'accepted', acceptedAt: serverTimestamp() });
    if (userPhone) {
      try {
        await fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerPhone: userPhone, salonName: state.ownerSalonData?.name || 'الصالون', customerName: userId, serviceName, dateTime, type: 'accepted' })
        });
      } catch(e) {}
    }
    showToast('✅ تم قبول الحجز');
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ في القبول'); }
};

window.rejectBooking = async (bookingId) => {
  const reason = prompt('سبب الرفض (اختياري):') || 'ظرف طارئ';
  try {
    await updateDoc(doc(db, "bookings", bookingId), {
      status: 'rejected', cancelReason: reason, cancelledBy: 'owner', cancelledAt: serverTimestamp()
    });
    showToast('تم رفض الحجز');
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ'); }
};

window.verifyCheckIn = async () => {
  const code = document.getElementById('qr-input-field').value.trim();
  if (!/^\d{6}$/.test(code)) return showToast('الكود يجب أن يكون 6 أرقام فقط');
  try {
    const snap = await getDocs(query(
      collection(db, "bookings"),
      where("salonId", "==", state.currentUser.username),
      where("checkInCode", "==", code)
    ));
    if (snap.empty) return showToast('❌ كود غير صحيح');
    const bookingDoc = snap.docs[0];
    const b = bookingDoc.data();
    if (b.status === 'cancelled' || b.status === 'rejected') return showToast('❌ هذا الحجز ملغي أو مرفوض');
    if (b.status === 'checkedin') return showToast(`⚠️ تم تسجيل حضور @${b.userId || b.user} مسبقاً`);
    await updateDoc(doc(db, "bookings", bookingDoc.id), {
      status: 'checkedin', acceptedAt: b.acceptedAt || serverTimestamp(), checkedInAt: serverTimestamp()
    });
    document.getElementById('qr-input-field').value = '';
    showToast(`✅ تم تسجيل حضور @${b.userId || b.user} — ${b.serviceName || b.service}`);
    loadOwnerDashboard();
  } catch(e) { showToast('خطأ في التحقق'); }
};

window.toggleAvailability = async () => {
  state.salonAvailable = !state.salonAvailable;
  const toggle = document.getElementById('avail-toggle');
  const label  = document.getElementById('avail-label');
  if (state.salonAvailable) { toggle.classList.add('on');    label.textContent = '🟢 متاح الآن'; }
  else                      { toggle.classList.remove('on'); label.textContent = '🔴 مشغول الآن'; }
  try {
    await updateDoc(doc(db, "salons", state.currentUser.username), { available: state.salonAvailable });
    showToast(state.salonAvailable ? 'الصالون الآن متاح ✓' : 'تم التحديث: مشغول الآن');
  } catch(e) { showToast('تحقق من الاتصال'); }
};

window.updateSalonData = async () => {
  const updates = {};
  const name      = document.getElementById('edit-salon-name').value.trim();
  const city      = document.getElementById('edit-salon-city').value.trim();
  const phone     = document.getElementById('edit-salon-phone').value.trim();
  const img       = document.getElementById('edit-salon-img').value.trim();
  const desc      = document.getElementById('edit-salon-desc').value.trim();
  const openTime  = document.getElementById('edit-open-time').value;
  const closeTime = document.getElementById('edit-close-time').value;

  if (name)      updates.name      = name;
  if (city)      updates.city      = city;
  if (phone)     updates.phone     = phone;
  if (img)       updates.img       = img;
  if (desc)      updates.desc      = desc;
  if (openTime)  updates.openTime  = openTime;
  if (closeTime) updates.closeTime = closeTime;

  if (!Object.keys(updates).length) return showToast('لا يوجد تعديلات للحفظ');
  try {
    await updateDoc(doc(db, "salons", state.currentUser.username), updates);
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
  state.ownerServices.push({ name, duration, price });
  try {
    await updateDoc(doc(db, "salons", state.currentUser.username), { services: state.ownerServices });
    closeModal('add-service-modal');
    renderOwnerServices();
    showToast('✓ تم إضافة الخدمة');
  } catch(e) { showToast('خطأ في الحفظ'); }
};

window.deleteService = async (idx) => {
  state.ownerServices.splice(idx, 1);
  try {
    await updateDoc(doc(db, "salons", state.currentUser.username), { services: state.ownerServices });
    renderOwnerServices();
    showToast('تم حذف الخدمة');
  } catch(e) {}
};
