import { db, collection, onSnapshot } from './firebase.js';
import state from './state.js';
import { showToast } from './ui.js';

export const demoSalons = [
  {
    id: "s1", name: "صالون الملكي", city: "طرابلس", gender: "men",
    available: true, rating: 4.8, reviews: 124,
    img: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600",
    services: [
      { name: "قص شعر",    duration: 30, price: 0.5 },
      { name: "حلاقة لحية", duration: 20, price: 0.3 },
      { name: "قص + لحية", duration: 45, price: 0.7 },
      { name: "تشكيل شعر", duration: 60, price: 1.0 }
    ]
  },
  {
    id: "s2", name: "باربيرا برو", city: "بنغازي", gender: "men",
    available: true, rating: 4.9, reviews: 89,
    img: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600",
    services: [
      { name: "قص كلاسيك", duration: 30, price: 0.8 },
      { name: "لحية فيد",  duration: 25, price: 0.5 },
      { name: "باقة VIP",  duration: 90, price: 1.5 }
    ]
  },
  {
    id: "s3", name: "Luxury Beauty", city: "القاهرة", gender: "women",
    available: true, rating: 4.9, reviews: 201,
    img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600",
    services: [
      { name: "قص وتصفيف", duration: 60,  price: 1.5 },
      { name: "صبغة كاملة", duration: 120, price: 3.0 },
      { name: "كيراتين",   duration: 180, price: 5.0 },
      { name: "مانيكير",   duration: 45,  price: 1.0 }
    ]
  },
  {
    id: "s4", name: "بيوتي لاونج", city: "طرابلس", gender: "women",
    available: true, rating: 4.7, reviews: 156,
    img: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600",
    services: [
      { name: "بروتين",    duration: 120, price: 2.5 },
      { name: "مكياج",     duration: 60,  price: 2.0 },
      { name: "تلوين أومبري", duration: 150, price: 4.0 }
    ]
  },
  {
    id: "s5", name: "جنتلمن كليب", city: "مصراتة", gender: "men",
    available: false, rating: 4.6, reviews: 67,
    img: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600",
    services: [
      { name: "قص مودرن",  duration: 35, price: 0.6 },
      { name: "كيراتين رجالي", duration: 90, price: 2.0 }
    ]
  },
  {
    id: "s6", name: "روز بيوتي", city: "بنغازي", gender: "women",
    available: true, rating: 4.8, reviews: 93,
    img: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600",
    services: [
      { name: "تصفيف عروس", duration: 180, price: 8.0 },
      { name: "قص أطراف",   duration: 30,  price: 0.8 },
      { name: "سبا",        duration: 90,  price: 3.5 }
    ]
  }
];

export function filterByGender(salons, gender) {
  return salons.filter(s => s.gender === gender || s.gender === 'both');
}

export function renderSalons(salons) {
  const container = document.getElementById('salon-container');
  if (!salons.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-store-slash"></i><p>لا توجد صالونات في هذه الفئة بعد</p></div>`;
    return;
  }

  window._salonMap = {};
  salons.forEach(s => { window._salonMap[s.id] = s; });

  const isWomen = state.currentGender === 'women';
  container.innerHTML = salons.map(s => `
    <div class="salon-card">
      <div class="salon-img-wrap">
        <img src="${s.img}" class="salon-img" alt="${s.name}" onerror="this.src='https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600'">
        <span class="availability-badge ${s.available ? 'available' : 'busy'}">
          ${s.available ? '🟢 متاح' : '🔴 مشغول'}
        </span>
        <span class="category-badge ${isWomen ? 'women-badge' : 'men-badge'}">
          ${isWomen ? '💅 سيدات' : '💈 رجال'}
        </span>
      </div>
      <div class="salon-body">
        <div class="salon-name">${s.name}</div>
        <div class="salon-meta">
          <span><i class="fas fa-map-marker-alt" style="color:var(--teal)"></i> ${s.city}</span>
          <span class="rating">★ ${s.rating}</span>
          <span style="color:var(--gray)">(${s.reviews} تقييم)</span>
        </div>
        ${s.openTime ? `<div style="font-size:12px;color:var(--gray);margin-bottom:8px;"><i class="fas fa-clock" style="color:var(--teal)"></i> ${s.openTime} - ${s.closeTime}</div>` : ''}
        ${s.desc ? `<div style="font-size:12px;color:var(--gray);margin-bottom:8px;font-style:italic;">${s.desc}</div>` : ''}
        <div class="services-preview">
          ${s.services.slice(0,3).map(sv => `<span class="service-tag ${isWomen ? 'service-tag-women' : ''}">${sv.name}</span>`).join('')}
          ${s.services.length > 3 ? `<span class="service-tag" style="background:#f0f0f0;color:#888">+${s.services.length-3}</span>` : ''}
        </div>
        <div class="salon-footer">
          <div class="price-range">
            من <strong>${s.services.length ? Math.min(...s.services.map(sv => sv.price)) : '—'} Pi</strong>
          </div>
          <button
            onclick="openBookingModal('${s.id}')"
            class="book-btn ${isWomen ? 'book-btn-women' : ''}"
            ${!s.available ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}
          >
            ${s.available ? 'احجز الآن' : 'مشغول'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Real-time listener
onSnapshot(collection(db, "salons"), snap => {
  const firebaseSalons = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || 'صالون',
      city: data.city || '',
      gender: data.gender || 'men',
      available: data.available !== false,
      rating: data.rating || 5.0,
      reviews: data.reviews || 0,
      services: data.services || [],
      phone: data.phone || data.ownerPhone || '',
      ownerPhone: data.phone || data.ownerPhone || '',
      img: data.img || '',
      openTime: data.openTime || '09:00',
      closeTime: data.closeTime || '21:00',
      desc: data.desc || '',
      source: 'firebase'
    };
  });
  const demoOnly = demoSalons.filter(d => !firebaseSalons.find(f => f.name === d.name));
  state.allSalons = [...firebaseSalons, ...demoOnly];
  renderSalons(filterByGender(state.allSalons, state.currentGender));
}, () => {
  state.allSalons = demoSalons;
  renderSalons(filterByGender(state.allSalons, state.currentGender));
});

window.switchGender = (gender) => {
  state.currentGender = gender;
  document.getElementById('tab-men').className   = 'gender-tab' + (gender === 'men'   ? ' active-men'   : '');
  document.getElementById('tab-women').className = 'gender-tab' + (gender === 'women' ? ' active-women' : '');
  renderSalons(filterByGender(state.allSalons, gender));
};

window.filterSalons = (val) => {
  const filtered = filterByGender(state.allSalons, state.currentGender)
    .filter(s => s.name.includes(val) || s.city.includes(val));
  renderSalons(filtered);
};
