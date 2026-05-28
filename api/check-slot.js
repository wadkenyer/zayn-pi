import { setCors, checkRateLimit, sanitize } from './_lib.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!checkRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { salonId, date, time } = req.body || {};

  const cleanSalonId = sanitize(salonId, 100);
  const cleanDate    = sanitize(date, 20);
  const cleanTime    = sanitize(time, 10);

  if (!cleanSalonId || !cleanDate || !cleanTime) {
    return res.status(400).json({ error: 'salonId و date و time مطلوبة' });
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return res.status(400).json({ error: 'تنسيق التاريخ غير صالح' });
  }

  // Validate time format (HH:MM)
  if (!/^\d{2}:\d{2}$/.test(cleanTime)) {
    return res.status(400).json({ error: 'تنسيق الوقت غير صالح' });
  }

  try {
    const projectId = 'zayn-pi';
    const dateTime = `${cleanDate} ${cleanTime}`;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const query = {
      structuredQuery: {
        from: [{ collectionId: 'bookings' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'salonId' },  op: 'EQUAL',     value: { stringValue: cleanSalonId } } },
              { fieldFilter: { field: { fieldPath: 'dateTime' }, op: 'EQUAL',     value: { stringValue: dateTime } } },
              { fieldFilter: { field: { fieldPath: 'status' },   op: 'NOT_EQUAL', value: { stringValue: 'cancelled' } } }
            ]
          }
        },
        limit: 1
      }
    };

    const response = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });

    const data = await response.json();
    const isBooked = Array.isArray(data) && data.length > 0 && data[0].document;

    return res.status(200).json({
      available: !isBooked,
      message: isBooked ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    return res.status(200).json({ available: true, message: 'تحقق جزئي' });
  }
}
