import { openDB, enqueueSync } from './syncQueue';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  sender: 'user' | 'bot';
  content: string;
  advisory?: any;
  nlu_result?: any;
  created_at: string;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  last_message_at: string;
}

/** Save message locally to IndexedDB and queue cloud sync */
export async function saveChatMessage(message: ChatMessageRecord): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['messages'], 'readwrite');
    tx.objectStore('messages').put(message);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save message to IndexedDB:', err);
  }

  enqueueSync('messages', 'insert', message).catch(err => {
    console.warn('Message sync enqueue warning:', err);
  });
}

/** Save or update conversation record */
export async function saveConversation(conversation: ConversationRecord): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['conversations'], 'readwrite');
    tx.objectStore('conversations').put(conversation);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save conversation to IndexedDB:', err);
  }

  enqueueSync('conversations', 'upsert', conversation).catch(err => {
    console.warn('Conversation sync enqueue warning:', err);
  });
}

/** Fetch all conversations for user from local IndexedDB */
export async function getLocalConversations(userId: string = 'local_farmer'): Promise<ConversationRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(['conversations'], 'readonly');
    const store = tx.objectStore('conversations');
    const req = store.getAll();

    const all: ConversationRecord[] = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });

    return all
      .filter(c => c.user_id === userId || userId === 'local_farmer')
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  } catch (err) {
    return [];
  }
}

/** Fetch messages for a specific conversation */
export async function getLocalMessages(conversationId: string): Promise<ChatMessageRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(['messages'], 'readonly');
    const index = tx.objectStore('messages').index('conversation_id');
    const req = index.getAll(conversationId);

    const msgs: ChatMessageRecord[] = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });

    return msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (err) {
    return [];
  }
}

/** Hydrate history from Supabase when online */
export async function hydrateHistoryFromCloud(userId: string): Promise<void> {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) return;

  try {
    const { data: cloudConvs } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId);

    if (cloudConvs && cloudConvs.length > 0) {
      const db = await openDB();
      const tx = db.transaction(['conversations'], 'readwrite');
      const store = tx.objectStore('conversations');
      for (const conv of cloudConvs) {
        store.put(conv);
      }
    }
  } catch (e) {
    console.warn('Cloud history sync warning:', e);
  }
}
