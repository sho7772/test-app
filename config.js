// Firebaseなどの設定を一箇所にまとめます
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dvfkc6l0d";
const CLOUDINARY_UPLOAD_PRESET = "Nd8oj7zj";

const firebaseConfig = {
  apiKey: "AIzaSyBzGdWG07Y_5SFmC4HOD3tde78F9HutSiI",
  authDomain: "test-app-371a4.firebaseapp.com",
  projectId: "test-app-371a4",
  storageBucket: "test-app-371a4.firebasestorage.app",
  messagingSenderId: "253478820619",
  appId: "1:253478820619:web:981b0b0f252a0953e3a00e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const cloudinaryConfig = { cloudName: CLOUDINARY_CLOUD_NAME, preset: CLOUDINARY_UPLOAD_PRESET };
