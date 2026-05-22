import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCIVvhhtH-gMnl70J0SDiCKoMe3iJRJnLc",
  authDomain: "arkanet-2003.firebaseapp.com",
  projectId: "arkanet-2003",
  storageBucket: "arkanet-2003.firebasestorage.app",
  messagingSenderId: "231954418325",
  appId: "1:231954418325:web:44060a035dc4c9293a299c"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
