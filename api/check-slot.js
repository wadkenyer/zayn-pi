// api/check-slot.js
// المهمة: منع حجز نفس الوقت مرتين في نفس الصالون
// بسيط وفعّال — بدون تعقيد غير ضروري

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { salonId, date, time } = req.body;

  if (!salonId || !date || !time) {
    return res.status(400).json({ error: 'salonId و date و time مطلوبة' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;

  try {
    // نتحقق من Firebase REST API مباشرة
    const projectId = 'zayn-pi';
    const dateTime = `${date} ${time}`;

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const query = {
      structuredQuery: {
        from: [{ collectionId: 'bookings' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'salonId' },
                  op: 'EQUAL',
                  value: { stringValue: salonId }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'dateTime' },
                  op: 'EQUAL',
                  value: { stringValue: dateTime }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'status' },
                  op: 'NOT_EQUAL',
                  value: { stringValue: 'cancelled' }
                }
              }
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

    // إذا وُجد حجز = الوقت محجوز
    const isBooked = Array.isArray(data) && data.length > 0 && data[0].document;

    return res.status(200).json({
      available: !isBooked,
      message: isBooked ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    console.error('check-slot error:', error.message);
    // في حال الخطأ نسمح بالحجز ونتحقق لاحقاً
    return res.status(200).json({ available: true, message: 'تحقق جزئي' });
  }
}
