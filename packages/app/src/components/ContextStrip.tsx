import React from 'react';

export function ContextStrip({ profile, lang }: { profile: any; lang: 'kn' | 'en' }) {
  // Mock implementations for stageLabel and areaLabel based on existing profile data
  const items = [
    profile.crop || 'Maize', 
    profile.stage ? `${profile.stage} days` : '',
    profile.location || 'Dharwad',
  ].filter(Boolean);
  
  return (
    <div className="strip" lang={lang} data-lang={lang}>
      {items.map(t => <span key={t}>{t}</span>)}
    </div>
  );
}
