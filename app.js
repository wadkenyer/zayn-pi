async function confirmBooking(){

await addDoc(collection(db, "bookings"), {
  salon: localStorage.getItem("salon"),
  price: localStorage.getItem("price"),
  createdAt: new Date()
});

window.location.href = "bookings.html";
}
