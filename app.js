Pi.createPayment({
    amount: 1,
    memo: "حجز صالون - ZAYN PI",
    metadata: { 
        service: "haircut",
        salonId: "s1"   // أضف أي بيانات إضافية تحتاجها
    }
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
            return data;   // مهم: يفضل ترجع الـ data
        } catch (err) {
            console.error("Error in approval:", err);
            throw err;   // مهم جداً عشان الـ SDK يعرف إن فيه مشكلة
        }
    },

    onReadyForServerCompletion: async (paymentId, txid) => {
        console.log("→ جاري إكمال الدفع...", paymentId, txid);

        try {
            // 1. حفظ الحجز في قاعدة البيانات (Firebase أو غيرها)
            // await addDoc(...) 

            // 2. إكمال الدفع عند Pi (مهم جداً)
            const completeRes = await fetch('/api/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId, txid })
            });

            if (!completeRes.ok) {
                console.warn("Complete API returned non-ok status");
            }

            console.log("✅ تم إكمال الدفع بنجاح");
            alert(`تم الدفع بنجاح!\nTX: ${txid.slice(0, 12)}...`);
        } catch (err) {
            console.error("Error in completion:", err);
        }
    },

    onCancel: (paymentId) => {
        console.log("تم إلغاء الدفع من المستخدم", paymentId);
        alert("تم إلغاء عملية الدفع");
    },

    onError: (error) => {
        console.error("Payment Error:", error);
        alert("حدث خطأ أثناء الدفع: " + (error.message || error));
    }
});
