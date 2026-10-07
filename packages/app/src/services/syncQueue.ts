import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SyncItem {
  id: string;
  table: 'profiles' | 'conversations' | 'messages' | 'analytics_events';
  action: 'insert' | 'update' | 'upsert' | 'delete';
  payload: any;
  sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
  retry_count?: number;
}

const DB_NAME = 'maize_advisor_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;

      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
        store.createIndex('sync_status', 'sync_status', { unique: false });
      }
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('conversations')) {
        const store = db.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('user_id', 'user_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('conversation_id', 'conversation_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('analytics_events')) {
        db.createObjectStore('analytics_events', { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

export function subscribeSyncStatus(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach(cb => cb());
}

/** Enqueue a mutation locally into IndexedDB with sync_status: 'pending' */
export async function enqueueSync(
  table: SyncItem['table'],
  action: SyncItem['action'],
  payload: any
): Promise<SyncItem> {
  const item: SyncItem = {
    id: `${table}_${payload.id || Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    table,
    action,
    payload,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0
  };

  try {
    const db = await openDB();
    const tx = db.transaction(['sync_queue'], 'readwrite');
    tx.objectStore('sync_queue').put(item);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    notifyListeners();

    // Trigger asynchronous sync if online
    if (navigator.onLine && isSupabaseConfigured) {
      flushSyncQueue().catch(err => console.warn('Background sync flush failed silently:', err));
    }
  } catch (err) {
    console.warn('Failed to enqueue sync item locally:', err);
  }

  return item;
}

/** Attempt to flush pending items to Supabase */
export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) {
    return { synced: 0, failed: 0 };
  }

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch (err) {
    return { synced: 0, failed: 0 };
  }

  const tx = db.transaction(['sync_queue'], 'readonly');
  const store = tx.objectStore('sync_queue');
  const req = store.getAll();

  const items: SyncItem[] = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });

  const pending = items.filter(i => i.sync_status === 'pending');
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      let error: any = null;
      if (item.action === 'insert' || item.action === 'upsert') {
        const { error: err } = await supabase.from(item.table).upsert(item.payload);
        error = err;
      } else if (item.action === 'update') {
        const { error: err } = await supabase
          .from(item.table)
          .update(item.payload)
          .eq('id', item.payload.id);
        error = err;
      } else if (item.action === 'delete') {
        const { error: err } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.payload.id);
        error = err;
      }

      const updateTx = db.transaction(['sync_queue'], 'readwrite');
      const queueStore = updateTx.objectStore('sync_queue');

      if (!error) {
        item.sync_status = 'synced';
        queueStore.put(item);
        synced++;
      } else {
        console.warn(`Supabase sync failed for item ${item.id}:`, error);
        item.sync_status = 'failed';
        item.retry_count = (item.retry_count || 0) + 1;
        queueStore.put(item);
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }

  notifyListeners();
  return { synced, failed };
}

/** Get counts of pending vs synced items */
export async function getPendingSyncCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(['sync_queue'], 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    const items: SyncItem[] = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    return items.filter(i => i.sync_status === 'pending').length;
  } catch (err) {
    return 0;
  }
}

// Auto-flush on network regain
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSyncQueue().catch(() => {});
  });
}
