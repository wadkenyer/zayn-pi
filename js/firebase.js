import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, setDoc, getDoc,
  serverTimestamp, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVePZCyyeVw9xDlov2B_db8VsIEayw8Rk",
  authDomain: "zayn-pi.firebaseapp.com",
  projectId: "zayn-pi"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  collection, addDoc, getDocs, doc, updateDoc, setDoc, getDoc,
  serverTimestamp, query, where, orderBy, limit, onSnapshot
};
