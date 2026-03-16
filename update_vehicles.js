const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, doc, setDoc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');
const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);
async function run() {
  const vehicles = [
    { id:"v1", plate:"WGM 0475M", plate2:"", type:"Solo", brand:"Iveco", year:2021, equipment:[], customEquipment:[], dimensions:"607x243x245", dimensions2:"", loadingType:"Bok", maxWeight:"3000", maxWeight2:"", driverHistory:[] },
    { id:"v2", plate:"TK 130EF", plate2:"", type:"Bus", brand:"Renault Master", year:2020, equipment:[], customEquipment:[], dimensions:"460x220x230", dimensions2:"", loadingType:"Bok", maxWeight:"820", maxWeight2:"", driverHistory:[] },
    { id:"v3", plate:"WGM 5367K", plate2:"", type:"Solo", brand:"Iveco", year:2022, equipment:[], customEquipment:[], dimensions:"620x245x260", dimensions2:"", loadingType:"Bok", maxWeight:"3000", maxWeight2:"", driverHistory:[] },
    { id:"v4", plate:"TK 314CL", plate2:"TK 760AP", type:"Bus", brand:"Iveco Bus + Przyczepa", year:2020, equipment:[], customEquipment:[], dimensions:"420x225x245", dimensions2:"640x245x250", loadingType:"Bok", maxWeight:"895", maxWeight2:"2100", driverHistory:[] },
    { id:"v5", plate:"WGM 0507M", plate2:"", type:"Solo", brand:"Iveco", year:2025, equipment:[], customEquipment:[], dimensions:"", dimensions2:"", loadingType:"Bok", maxWeight:"", maxWeight2:"", driverHistory:[] },
    { id:"v6", plate:"TK 315CL", plate2:"TK 761AP", type:"Bus", brand:"Iveco Bus + Przyczepa", year:2020, equipment:[], customEquipment:[], dimensions:"420x225x245", dimensions2:"640x245x250", loadingType:"Bok", maxWeight:"895", maxWeight2:"2100", driverHistory:[] },
  ];
  await setDoc(doc(db, "fleet", "data"), { fleetv2_vehicles: vehicles }, { merge: true });
  console.log("OK - zaktualizowano", vehicles.length, "pojazdow");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
