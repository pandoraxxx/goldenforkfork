import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'backend/data/db.json');

const defaultDb = {
  subscriptions: [],
  notifications: [],
  favorites: [],
  preferences: {
    goldenCrossPair: '5-20',
  },
};

function safeParse(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf8');
    return structuredClone(defaultDb);
  }

  const parsed = safeParse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!parsed || typeof parsed !== 'object') {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf8');
    return structuredClone(defaultDb);
  }

  return {
    ...defaultDb,
    ...parsed,
    subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    preferences: {
      ...defaultDb.preferences,
      ...(parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {}),
    },
  };
}

export function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}
