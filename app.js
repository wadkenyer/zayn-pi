// app.js — دالة مساعدة لبدء الدفع، تُستدعى من booking.html
window.startPiPayment = function({ amount, memo, metadata, onApprove, onComplete, onCancel, onError }) {
    Pi.createPayment({
        amount,
        memo,
        metadata
    }, {
        onReadyForServerApproval: async (paymentId) => {
            console.log("→ جاري الموافقة على الدفع...", paymentId);
            try {
                const res = await fetch('/api/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentId })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    console.error("Approve failed:", data);
                    throw new Error(data.error || "فشل في موافقة السيرفر");
                }
                console.log("✅ تمت الموافقة من السيرفر");
                if (onApprove) onApprove(paymentId, data);
            } catch (err) {
                console.error("Error in approval:", err);
                throw err;
            }
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
            console.log("→ جاري إكمال الدفع...", paymentId, txid);
            try {
                const completeRes = await fetch('/api/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentId, txid })
                });
                if (!completeRes.ok) {
                    console.warn("Complete API returned non-ok status");
                }
                console.log("✅ تم إكمال الدفع بنجاح");
                if (onComplete) onComplete(paymentId, txid);
            } catch (err) {
                console.error("Error in completion:", err);
                if (onError) onError(err);
            }
        },

        onCancel: (paymentId) => {
            console.log("تم إلغاء الدفع من المستخدم", paymentId);
            if (onCancel) onCancel(paymentId);
        },

        onError: (error) => {
            console.error("Payment Error:", error);
            if (onError) onError(error);
        }
    });
};
