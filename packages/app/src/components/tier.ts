import type { Advisory } from '@advisor/core';

export type Tier = 'act' | 'watch' | 'hold';

export function tierFor(a: Advisory): Tier {
  if (a.confidence === 'LOW' || a.confidence === 'DATA_INSUFFICIENT') return 'hold';
  switch (a.headline) {
    case 'IRRIGATE': case 'APPLY': case 'SOW': case 'HARVEST': return 'act';
    case 'SCOUT': case 'WAIT': return 'watch';
    default: return 'hold';
  }
}
