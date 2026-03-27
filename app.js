function book(name, price){
localStorage.setItem("salon", name);
localStorage.setItem("price", price);
window.location.href = "booking.html";
}

function confirmBooking(){

let bookings = JSON.parse(localStorage.getItem("bookings") || "[]");

bookings.push({
salon: localStorage.getItem("salon"),
price: localStorage.getItem("price"),
date: new Date().toLocaleString()
});

localStorage.setItem("bookings", JSON.stringify(bookings));

window.location.href = "bookings.html";
}

window.onload = function(){

if(document.getElementById("salon")){
document.getElementById("salon").innerText =
"الصالون: " + localStorage.getItem("salon");

document.getElementById("price").innerText =
"السعر: " + localStorage.getItem("price") + " Pi";
}

if(document.getElementById("list")){
let bookings = JSON.parse(localStorage.getItem("bookings") || "[]");

let container = document.getElementById("list");

if(bookings.length === 0){
container.innerHTML = "لا يوجد حجوزات";
}

bookings.forEach(b => {
container.innerHTML += `
<div class="card">
<p>${b.salon}</p>
<p>${b.price} Pi</p>
</div>
`;
});
}

}