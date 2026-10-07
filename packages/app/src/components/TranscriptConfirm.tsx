import React from 'react';

interface Props {
  text: string;
  onEdit: () => void;
  lang: 'kn' | 'en';
}

export function TranscriptConfirm({ text, onEdit, lang }: Props) {
  return (
    <div className="transcript" lang={lang} data-lang={lang}>
      <span>{text}</span>
      <button onClick={onEdit} aria-label={lang === 'kn' ? 'ತಿದ್ದಿ' : 'Edit'}>
        <i className="ti ti-pencil" aria-hidden="true" />
      </button>
    </div>
  );
}
