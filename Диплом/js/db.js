// ===== DATABASE (IndexedDB) =====
const DB_NAME = 'ApexSportDB';
const DB_VERSION = 1;
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('products')) {
        const store = d.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('badge', 'badge', { unique: false });
      }
      if (!d.objectStoreNames.contains('orders')) {
        const os = d.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        os.createIndex('status', 'status', { unique: false });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbTx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = dbTx(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = dbTx(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const req = dbTx(storeName, 'readwrite').put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const req = dbTx(storeName, 'readwrite').add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = dbTx(storeName, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== SEED INITIAL DATA =====
const SEED_PRODUCTS = [
  { name:'Nike Air Max 270', brand:'Nike', category:'shoes', price:3299, oldPrice:4199, emoji:'👟', rating:4.8, reviews:342, badge:'sale', stock:24, desc:'Легкі бігові кросівки з технологією Air Max для максимального комфорту та амортизації.', sizes:'40,41,42,43,44,45' },
  { name:'Adidas Ultraboost 22', brand:'Adidas', category:'shoes', price:3799, emoji:'🥾', rating:4.9, reviews:512, badge:'hit', stock:15, desc:'Культові кросівки з технологією Boost — повернення енергії при кожному кроці.', sizes:'39,40,41,42,43,44' },
  { name:'Under Armour Charged', brand:'Under Armour', category:'shoes', price:2299, oldPrice:2999, emoji:'🏃', rating:4.6, reviews:198, badge:'sale', stock:8, desc:'Ідеальні для тренувань — легкі, з міцною посадкою і відмінним зчепленням.', sizes:'40,41,42,43,44' },
  { name:'Pro Combat Compression', brand:'Nike', category:'clothing', price:799, emoji:'👕', rating:4.7, reviews:284, badge:'new', stock:42, desc:'Компресійна футболка з технологією Dri-FIT для відводу вологи та комфорту рухів.', sizes:'XS,S,M,L,XL,XXL' },
  { name:'Training Shorts Elite', brand:'Adidas', category:'clothing', price:699, emoji:'🩳', rating:4.5, reviews:156, badge:null, stock:31, desc:'Легкі тренувальні шорти з кишенями на блискавці та регульованим поясом.', sizes:'XS,S,M,L,XL,XXL' },
  { name:'Thermal Running Jacket', brand:'The North Face', category:'clothing', price:2499, oldPrice:3199, emoji:'🧥', rating:4.8, reviews:423, badge:'sale', stock:12, desc:'Тепла вітрозахисна куртка для пробіжок в прохолодну пору.', sizes:'XS,S,M,L,XL' },
  { name:'Wilson Pro Staff RF97', brand:'Wilson', category:'equipment', price:6299, emoji:'🎾', rating:4.9, reviews:87, badge:'hit', stock:5, desc:'Тенісна ракетка Роджера Федерера — контроль і потужність для професіоналів.', sizes:'L1,L2,L3,L4' },
  { name:'PowerBlock Elite Dumbbell', brand:'PowerBlock', category:'equipment', price:4799, emoji:'🏋️', rating:4.7, reviews:234, badge:'new', stock:9, desc:'Регульовані гантелі 5-50 кг — замінюють 16 пар. Ідеально для домашніх тренувань.', sizes:'5-25kg,5-50kg' },
  { name:'Garmin Forerunner 945', brand:'Garmin', category:'accessories', price:8999, emoji:'⌚', rating:4.9, reviews:678, badge:'hit', stock:7, desc:'Мультиспортивний GPS-годинник з картами, VO2 Max, планами тренувань та 36 год GPS.', sizes:'One Size' },
  { name:'Hydration Vest 12L', brand:'Salomon', category:'accessories', price:1899, emoji:'🎒', rating:4.6, reviews:143, badge:'new', stock:18, desc:'Жилет для гідратації 12л — легкий, обтічний, з фляжками SoftFlask 500мл.', sizes:'XS/S,M/L,XL/XXL' },
  { name:'Concept2 RowErg', brand:'Concept2', category:'equipment', price:22999, emoji:'🚣', rating:5.0, reviews:312, badge:null, stock:3, desc:'Найкращий гребний тренажер у світі. Використовується профі атлетами та CrossFit.', sizes:'Standard,Tall' },
  { name:'Puma RS-X Basketball', brand:'Puma', category:'shoes', price:1999, oldPrice:2599, emoji:'🏀', rating:4.4, reviews:89, badge:'sale', stock:22, desc:'Баскетбольні кросівки з посиленою боковою підтримкою та технологією RS піни.', sizes:'40,41,42,43,44,45,46' },
];

async function seedIfEmpty() {
  const existing = await dbGetAll('products');
  if (existing.length === 0) {
    for (const p of SEED_PRODUCTS) await dbAdd('products', p);
  }
}
