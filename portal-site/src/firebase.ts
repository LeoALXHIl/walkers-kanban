import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Mesmo projeto Firebase do app Walkers Kanban.
const firebaseConfig = {
  apiKey: 'AIzaSyCqoVXms7wjEs_Ja8Tr8FzGXp_FSuiZd8g',
  authDomain: 'walkerskambam.firebaseapp.com',
  projectId: 'walkerskambam',
  storageBucket: 'walkerskambam.firebasestorage.app',
  messagingSenderId: '192188793356',
  appId: '1:192188793356:web:036dd4c82efa8531582429'
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
