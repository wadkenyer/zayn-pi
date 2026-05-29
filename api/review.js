import { FieldValue } from 'firebase-admin/firestore';
import { setCors, checkRateLimit, verifyPiToken, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) return res.status(429).json({ error: 'Too many requests' });

  // VULN-07 fix: verify Pi token — never trust client-supplied userId
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) return res.status(401).json({ error: 'غير مصرح' });

  const { bookingId, stars, comment } = req.body || {};

  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({ error: 'bookingId مطلوب' });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
  }

  const cleanBookingId = sanitize(bookingId, 100);
  const cleanComment   = sanitize(comment || '', 500);

  try {
    const db = getDb();
    const bookingRef  = db.collection('bookings').doc(cleanBookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) return res.status(404).json({ error: 'الحجز غير موجود' });

    const booking = bookingSnap.data();

    // Verify ownership: booking must belong to the authenticated user
    if (booking.user !== verifiedUser && booking.userId !== verifiedUser) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    if (booking.status !== 'checkedin' && booking.status !== 'completed') {
      return res.status(400).json({ error: 'لا يمكن تقييم هذا الحجز' });
    }

    if (booking.isReviewed) {
      return res.status(409).json({ error: 'تم تقييم هذا الحجز مسبقاً' });
    }

    await bookingRef.update({
      isReviewed: true,
      reviewStars: stars,
      reviewComment: cleanComment,
      reviewedAt: FieldValue.serverTimestamp()
    });

    // Update salon rating atomically
    const salonId = booking.salonId;
    if (salonId) {
      try {
        await db.runTransaction(async (txn) => {
          const salonRef  = db.collection('salons').doc(salonId);
          const salonSnap = await txn.get(salonRef);
          if (!salonSnap.exists) return;
          const d          = salonSnap.data();
          const oldReviews = d.reviews || 0;
          const newReviews = oldReviews + 1;
          const newRating  = parseFloat((((d.rating || 5.0) * oldReviews + stars) / newReviews).toFixed(1));
          txn.update(salonRef, { rating: newRating, reviews: newReviews });
        });
      } catch(e) {
        console.error('review: salon rating update error', e);
      }
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('review error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
}
