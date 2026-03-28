Pi.createPayment({
  amount: 1,
  memo: "Salon Booking",
  metadata: { service: "haircut" }
}, {
  onReadyForServerApproval: function(paymentId) {

    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId })
    });

  },

  onReadyForServerCompletion: function(paymentId, txid) {
    console.log("Payment done:", txid);
  },

  onCancel: function(paymentId) {
    console.log("Cancelled");
  },

  onError: function(error) {
    console.error(error);
  }
});