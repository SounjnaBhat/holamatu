import React, { useEffect, useState } from 'react';
import { getLocalConversations, getLocalMessages, ConversationRecord, ChatMessageRecord } from '../services/chatService';

interface HistoryTabProps {
  onSelectConversation: (conversationId: string, messages: ChatMessageRecord[]) => void;
  onNewChat: () => void;
  lang?: 'kn' | 'en';
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ onSelectConversation, onNewChat, lang = 'kn' }) => {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const list = await getLocalConversations();
    setConversations(list);
    setLoading(false);
  };

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConversationClick = async (convId: string) => {
    const msgs = await getLocalMessages(convId);
    onSelectConversation(convId, msgs);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
          {lang === 'kn' ? '📜 ಹಳೆಯ ಸಂಭಾಷಣೆಗಳು' : '📜 Conversation History'}
        </h2>
        <button
          onClick={onNewChat}
          style={{
            background: 'var(--accent, #22c55e)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-pill, 9999px)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>➕</span> {lang === 'kn' ? 'ಹೊಸ ಚಾಟ್' : 'New Chat'}
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={lang === 'kn' ? 'ಹುಡುಕಿ...' : 'Search conversations...'}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-pill, 9999px)',
            border: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-sunk, #f8fafc)',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
          {lang === 'kn' ? 'ಸಂಭಾಷಣೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading past conversations...'}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--surface-card, #ffffff)',
            borderRadius: 'var(--radius-card, 16px)',
            border: '1px solid var(--border, #e2e8f0)',
            color: 'var(--text-secondary, #64748b)'
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🌾</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
            {lang === 'kn' ? 'ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆ ಇಲ್ಲ' : 'No saved conversations yet'}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
            {lang === 'kn'
              ? 'ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ — ನಿಮ್ಮ ಎಲ್ಲಾ ಸಲಹೆಗಳು ಇಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಉಳಿಯುತ್ತವೆ.'
              : 'Ask your farming questions — all advisories will automatically be saved here.'}
          </p>
          <button
            onClick={onNewChat}
            style={{
              background: 'var(--accent, #22c55e)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-pill, 9999px)',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {lang === 'kn' ? 'ಪ್ರಶ್ನೆ ಕೇಳಿ' : 'Ask a Question'}
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleConversationClick(conv.id)}
              style={{
                background: 'var(--surface-card, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 'var(--radius-card, 16px)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary, #1e293b)', marginBottom: '4px' }}>
                  {conv.title || 'Maize Advisory Session'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📅 {new Date(conv.last_message_at).toLocaleDateString()}</span>
                  <span>⏰ {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <div style={{ color: 'var(--accent, #22c55e)', fontSize: '18px' }}>➔</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
