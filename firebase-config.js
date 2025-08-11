// Import the functions you need from Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDV5KC17pP8eHXTZctJnbeohn_ZfyLTeHE",
  authDomain: "jnv-house-marks.firebaseapp.com",
  projectId: "jnv-house-marks",
  storageBucket: "jnv-house-marks.firebasestorage.app",
  messagingSenderId: "658968257297",
  appId: "1:658968257297:web:cd314cf6aba4ad34fba2b0",
  measurementId: "G-22CTRE43M4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export db so we can use it in other files
export { db };
