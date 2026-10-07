import React from 'react';
import type { Advisory } from '@advisor/core';
import { tierFor } from './tier';
import { WhyPanel } from './WhyPanel';

const ICON: Record<string, string> = {
  IRRIGATE: 'ti-droplet', APPLY: 'ti-flask', SOW: 'ti-seeding',
  HARVEST: 'ti-tractor', SCOUT: 'ti-eye', WAIT: 'ti-clock',
  INFORM: 'ti-info-circle',
};

const ACTION_LINES_EN: Record<string, string> = {
  IRRIGATE: 'Irrigate your field today',
  APPLY: 'Apply treatment',
  SOW: 'Ready for sowing',
  HARVEST: 'Ready for harvest',
  SCOUT: 'Scout your field',
  WAIT: 'No action needed right now',
  INFORM: 'Information provided',
};

const ACTION_LINES_KN: Record<string, string> = {
  IRRIGATE: 'ಇಂದು ನೀರು ಹಾಕಿ',
  APPLY: 'ಔಷಧಿ ಸಿಂಪಡಿಸಿ',
  SOW: 'ಬಿತ್ತನೆಗೆ ಸಿದ್ಧವಾಗಿದೆ',
  HARVEST: 'ಕೊಯ್ಲಿಗೆ ಸಿದ್ಧವಾಗಿದೆ',
  SCOUT: 'ಹೊಲವನ್ನು ಪರಿಶೀಲಿಸಿ',
  WAIT: 'ಈಗ ಯಾವುದೇ ಕ್ರಮ ಅಗತ್ಯವಿಲ್ಲ',
  INFORM: 'ಮಾಹಿತಿ ಒದಗಿಸಲಾಗಿದೆ',
};

export function AdvisoryCard({ advisory, lang }: { advisory: any; lang: 'kn' | 'en' }) {
  const tier = tierFor(advisory);
  
  const actionLine = advisory.actionLine || (lang === 'kn' ? ACTION_LINES_KN[advisory.headline] : ACTION_LINES_EN[advisory.headline]) || advisory.headline;
  const category = advisory.categoryLabel || advisory.intent.replace(/_/g, ' ');

  return (
    <article className="card" lang={lang} data-lang={lang}>
      <header className={`verdict verdict--${tier}`}>
        <div className="verdict__meta">
          <i className={`ti ${ICON[advisory.headline] || 'ti-info-circle'}`} aria-hidden="true" />
          <span style={{ textTransform: 'capitalize' }}>{category}</span>
        </div>
        <h3 className="verdict__action">{actionLine}</h3>
      </header>

      {advisory.facts && advisory.facts.length > 0 && (
        <dl className="facts">
          {advisory.facts.map(f => (
            <div className="facts__row" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}{f.unit ? ` ${f.unit}` : ''}</dd>
            </div>
          ))}
        </dl>
      )}

      {advisory.cautions && advisory.cautions.length > 0 && (
        <div className="caution" role="note">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span>{advisory.cautions.join(' ')}</span>
        </div>
      )}

      {advisory.evidence && <WhyPanel advisory={advisory} lang={lang} />}
    </article>
  );
}
