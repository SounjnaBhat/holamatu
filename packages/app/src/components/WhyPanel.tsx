import React from 'react';

export function WhyPanel({ advisory, lang }: { advisory: any; lang: 'kn' | 'en' }) {
  const e = advisory.evidence;
  if (!e) return null;
  
  return (
    <details className="why">
      <summary>
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>{lang === 'kn' ? 'ಏಕೆ ಈ ಸಲಹೆ?' : 'Why this answer?'}</span>
        <i className="ti ti-chevron-down why__chev" aria-hidden="true" />
      </summary>
      <div className="why__body">
        {e.ruleIds && e.ruleIds.length > 0 && <p className="why__rule">{e.ruleIds.join(', ')}</p>}
        {e.featureSnapshot && (
          <dl className="facts facts--compact">
            {Object.entries(e.featureSnapshot).map(([key, val]) => (
              <div className="facts__row" key={key}>
                <dt>{key}</dt><dd>{String(val)}</dd>
              </div>
            ))}
          </dl>
        )}
        {e.parameterLevel && (
          <p className="why__level">
            {lang === 'kn' ? 'ಮಾಹಿತಿ ಮೂಲ' : 'Parameter source'}: {e.parameterLevel}
          </p>
        )}
        {e.sources && e.sources.length > 0 && (
          <ul className="why__sources">
            {e.sources.map((s: any, idx: number) => <li key={idx}>{s.doc}, p.{s.page}</li>)}
          </ul>
        )}
      </div>
    </details>
  );
}
