import { openDB, enqueueSync } from './syncQueue';

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: 'query' | 'intent_detected' | 'error' | 'advisory_generated';
  intent?: string;
  location?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export function logAnalyticsEvent(
  userId: string,
  eventType: AnalyticsEvent['event_type'],
  intent?: string,
  location?: string,
  metadata?: Record<string, any>
): void {
  // Non-blocking fire-and-forget
  setTimeout(async () => {
    try {
      const event: AnalyticsEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId || 'local_farmer',
        event_type: eventType,
        intent,
        location,
        metadata,
        created_at: new Date().toISOString()
      };

      // Save locally
      const db = await openDB();
      const tx = db.transaction(['analytics_events'], 'readwrite');
      tx.objectStore('analytics_events').put(event);

      // Enqueue sync for background flush
      enqueueSync('analytics_events', 'insert', event).catch(() => {});
    } catch (e) {
      // Ignore failures silently
    }
  }, 0);
}
