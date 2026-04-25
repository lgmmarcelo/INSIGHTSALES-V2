import { getDocs, collection, query, limit } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function check() {
    const q = query(collection(db, 'sales'), limit(10));
    const snap = await getDocs(q);
    snap.forEach(d => {
        console.log("ID:", d.id);
        console.log("houveVenda:", d.data().houveVenda);
        console.log("status:", d.data().status);
        console.log("dataAtendimento:", d.data().dataAtendimento);
    });
}
check();
