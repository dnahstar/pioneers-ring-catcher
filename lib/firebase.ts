import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZ_53583g2LGFzraMBaSyDe1L4t84pzXw",
  authDomain: "ring-catcher.firebaseapp.com",
  projectId: "ring-catcher",
  storageBucket: "ring-catcher.firebasestorage.app",
  messagingSenderId: "519800455171",
  appId: "1:519800455171:web:7d8093117aa676aacdce36"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 
