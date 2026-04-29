import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, connectFirestoreEmulator } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const snap = await getDocs(collection(db, 'sales'));
  let feb = 0;
  let febVgv = 0;
  let jan = 0;
  let janVgv = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.dataAtendimentoIso && data.dataAtendimentoIso.startsWith('2026-02')) {
       feb++;
       febVgv += data.valor || 0;
    }
    if (data.dataAtendimentoIso && data.dataAtendimentoIso.startsWith('2026-01')) {
       jan++;
       janVgv += data.valor || 0;
    }
    // Also check for 26-02
    if (data.dataAtendimentoIso && data.dataAtendimentoIso.startsWith('26-02')) {
       feb++;
       febVgv += data.valor || 0;
    }
  });
  console.log(`Jan: ${jan} cotas, VGV: ${janVgv}`);
  console.log(`Feb: ${feb} cotas, VGV: ${febVgv}`);
}
check().catch(console.error);
