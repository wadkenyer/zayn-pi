import { db, doc, updateDoc, getDoc, serverTimestamp } from './firebase.js';
import { showToast, openModal, closeModal } from './ui.js';

let _reviewBookingId = null;
let _reviewSalonId   = null;
let _selectedStars   = 0;

const starLabels = ['', 'سيء 😞', 'مقبول 😐', 'جيد 🙂', 'ممتاز 😊', 'رائع جداً 🤩'];

window.openReviewModal = (bookingId, salonName, serviceName, salonId) => {
  _reviewBookingId = bookingId;
  _reviewSalonId   = salonId;
  _selectedStars   = 0;
  document.getElementById('review-salon-name').textContent   = salonName;
  document.getElementById('review-service-name').textContent = serviceName;
  document.getElementById('review-comment').value = '';
  document.getElementById('star-label').textContent = '';
  document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('active'));
  openModal('review-modal');
};

window.selectStar = (val) => {
  _selectedStars = val;
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.v) <= val);
  });
  document.getElementById('star-label').textContent = starLabels[val] || '';
};

window.submitReview = async () => {
  if (!_selectedStars) return showToast('اختر عدد النجوم أولاً');
  const comment = document.getElementById('review-comment').value.trim();
  try {
    await updateDoc(doc(db, "bookings", _reviewBookingId), {
      isReviewed: true, reviewStars: _selectedStars, reviewComment: comment, reviewedAt: serverTimestamp()
    });

    if (_reviewSalonId) {
      try {
        const salonRef  = doc(db, "salons", _reviewSalonId);
        const salonSnap = await getDoc(salonRef);
        if (salonSnap.exists()) {
          const d          = salonSnap.data();
          const oldReviews = d.reviews || 0;
          const newReviews = oldReviews + 1;
          const newRating  = parseFloat(((( d.rating || 5.0) * oldReviews + _selectedStars) / newReviews).toFixed(1));
          await updateDoc(salonRef, { rating: newRating, reviews: newReviews });
        }
      } catch(e) {}
    }

    closeModal('review-modal');
    showToast('✅ شكراً! تم إرسال تقييمك');

    const card = document.getElementById(`booking-${_reviewBookingId}`);
    if (card) {
      const reviewBtn = card.querySelector('.review-btn');
      if (reviewBtn) {
        const done = document.createElement('div');
        done.className   = 'review-done';
        done.textContent = '✅ شكراً على تقييمك!';
        reviewBtn.replaceWith(done);
      }
    }
  } catch(e) {
    showToast('خطأ في إرسال التقييم');
  }
};
