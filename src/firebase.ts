// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfHGwwZ4OmrbR6oSTUO3z22D8qwDO8JlI",
  authDomain: "able-coast-476610-a1.firebaseapp.com",
  projectId: "able-coast-476610-a1",
  storageBucket: "able-coast-476610-a1.firebasestorage.app",
  messagingSenderId: "305932858291",
  appId: "1:305932858291:web:cbfdf9fbc8c83ed476d1c6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
