import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MaizeAdvisorCore } from '@advisor/core';
import { MockGeminiPort } from '@advisor/core/src/network/ports';

import './styles/tokens.css';
import './styles/base.css';
import './styles/card.css';

import { AdvisoryCard } from './components/AdvisoryCard';
import { ContextStrip } from './components/ContextStrip';
import { TranscriptConfirm } from './components/TranscriptConfirm';
import { callGroq, callGroqNLU } from './llm';
import { NullGenerationPort, type NLUPort } from '@advisor/core/src/network/ports';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { HistoryTab } from './components/HistoryTab';
import { ProfileTab } from './components/ProfileTab';

import { saveChatMessage, saveConversation, getLocalMessages, ChatMessageRecord } from './services/chatService';
import { getLocalProfile, saveProfile, UserProfile } from './services/profileService';
import { logAnalyticsEvent } from './services/analyticsService';
import { getPendingSyncCount, subscribeSyncStatus, flushSyncQueue } from './services/syncQueue';

class GroqNLUPort implements NLUPort {
  async extractIntent(utterance: string): Promise<any> {
    return await callGroqNLU(utterance);
  }
}

function parseMarkdown(text: string): React.ReactNode[] {
  const sanitized = text.replace(/<[^>]*>?/gm, '');
  const lines = sanitized.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, li) => {
    if (li > 0) elements.push(<br key={`br-${li}`} />);
    let heading: React.ReactNode | null = null;
    if (line.startsWith('### ')) heading = <h3 key={`h-${li}`}>{parseBold(line.slice(4))}</h3>;
    else if (line.startsWith('## ')) heading = <h2 key={`h-${li}`}>{parseBold(line.slice(3))}</h2>;
    else if (line.startsWith('# ')) heading = <h1 key={`h-${li}`}>{parseBold(line.slice(2))}</h1>;

    if (heading) elements.push(heading);
    else if (line.startsWith('- ')) elements.push(<span key={`li-${li}`} style={{ display: 'block', paddingLeft: '8px' }}>{'• '}{parseBold(line.slice(2))}</span>);
    else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) elements.push(<em key={`em-${li}`}>{line.slice(1, -1)}</em>);
    else elements.push(<span key={`s-${li}`}>{parseBold(line)}</span>);
  });
  return elements;
}

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

const core = new MaizeAdvisorCore({
  generationEnabled: false,
  generationPort: new MockGeminiPort(),
  nluPort: new GroqNLUPort()
});

// ─── Web Speech API Hook ───
type SpeechLang = 'kn-IN' | 'en-IN';

interface SpeechState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  detectedLang: SpeechLang;
  isSupported: boolean;
  error: string | null;
}

function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    detectedLang: 'kn-IN',
    isSupported: false,
    error: null,
  });
  const recognitionRef = useRef<any>(null);
  const currentLangRef = useRef<SpeechLang>('kn-IN');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setState(s => ({ ...s, isSupported: true }));
    }
  }, []);

  const startListening = useCallback((lang: SpeechLang = 'kn-IN') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState(s => ({ ...s, error: 'Speech recognition not supported' }));
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    currentLangRef.current = lang;

    recognition.onstart = () => {
      setState(s => ({ ...s, isListening: true, transcript: '', interimTranscript: '', detectedLang: lang, error: null }));
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      setState(s => ({ ...s, transcript: final, interimTranscript: interim }));
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setState(s => ({ ...s, error: event.error, isListening: false }));
      }
    };

    recognition.onend = () => setState(s => ({ ...s, isListening: false }));
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  const toggleLang = useCallback(() => {
    const newLang: SpeechLang = currentLangRef.current === 'kn-IN' ? 'en-IN' : 'kn-IN';
    currentLangRef.current = newLang;
    setState(s => ({ ...s, detectedLang: newLang }));
    return newLang;
  }, []);

  return { ...state, startListening, stopListening, toggleLang };
}

// ─── Types ───
interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  followUps?: string[];
  advisory?: any;
  isTranscript?: boolean;
}

// ─── Inner Main App Content ───
function MainAppContent() {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'profile'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => `conv_${Date.now()}`);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [appState, setAppState] = useState({
    sessionId: currentConversationId,
    turnIndex: 0,
    previousAdvisory: null as any,
    pendingIntent: undefined as string | undefined,
    farmerId: user?.id || 'f_001',
    location: 'Dharwad',
    stage: 'V4',
    weatherFeatures: { dToday: 60, forecastRain72h: 0 },
  });

  const speech = useSpeechRecognition();

  useEffect(() => {
    core.initialize().then(() => setIsReady(true));
    
    // Load local profile data
    getLocalProfile(user?.id || 'local_farmer').then(prof => {
      setAppState(s => ({
        ...s,
        farmerId: prof.id,
        location: prof.location || 'Dharwad',
        stage: prof.crop_stage || 'V4'
      }));
    });

    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const unsubscribe = subscribeSyncStatus(() => {
      getPendingSyncCount().then(setPendingSyncCount);
    });
    getPendingSyncCount().then(setPendingSyncCount);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, activeTab]);

  useEffect(() => {
    if (speech.transcript && !speech.isListening) {
      handleSend(speech.transcript, true);
    }
  }, [speech.transcript, speech.isListening]);

  useEffect(() => {
    if (speech.isListening && speech.interimTranscript) {
      setInput(speech.interimTranscript);
    }
  }, [speech.interimTranscript, speech.isListening]);

  const handleSend = async (text?: string, isFromSpeech = false) => {
    const msg = (text || input).trim();
    if (!msg || !isReady || isThinking) return;

    const timestamp = new Date();
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: msg,
      timestamp,
      isTranscript: isFromSpeech
    };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setIsThinking(true);

    const currentState = { ...appState, turnIndex: appState.turnIndex + 1 };
    const nowIso = timestamp.toISOString();

    // Persist user message local-first
    saveChatMessage({
      id: userMsg.id,
      conversation_id: currentConversationId,
      sender: 'user',
      content: msg,
      created_at: nowIso
    });

    try {
      const botRes = await core.processUtterance(msg, currentState);
      setAppState(currentState);

      let followUps = botRes.advisory?.suggestedFollowUps || [];
      if (!botRes.advisory && botRes.text) {
        if (botRes.text.includes('Which district') || botRes.text.includes('stage')) {
           followUps = ['Dharwad', 'Hubli', '30 days', 'Sowing'];
        } else {
           followUps = ['Irrigation', 'Pest Control', 'Fertilizer'];
        }
      }

      // Re-enable Groq LLM overriding the text response
      let finalBotText = botRes.text;
      try {
        const history = messages.map(m => ({ role: m.sender, text: m.text }));
        // If there's an advisory, pass it as JSON context. Otherwise, pass the raw text which might contain dataset RAG results!
        const ctxStr = botRes.advisory ? JSON.stringify(botRes.advisory) : (botRes.text || null);
        const llmResponse = await callGroq(history, msg, ctxStr);
        if (llmResponse) {
          finalBotText = llmResponse;
        }
      } catch (err) {
        console.warn('Groq LLM failed, falling back to rule engine text', err);
      }

      const botTimestamp = new Date();
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: finalBotText,
        timestamp: botTimestamp,
        followUps,
        advisory: botRes.advisory
      };
      setMessages(m => [...m, botMsg]);

      // Persist bot message local-first with advisory & traceability
      saveChatMessage({
        id: botMsg.id,
        conversation_id: currentConversationId,
        sender: 'bot',
        content: finalBotText,
        advisory: botRes.advisory,
        created_at: botTimestamp.toISOString()
      });

      // Update conversation index record
      saveConversation({
        id: currentConversationId,
        user_id: user?.id || appState.farmerId,
        title: msg.length > 32 ? msg.substring(0, 32) + '...' : msg,
        created_at: nowIso,
        last_message_at: botTimestamp.toISOString()
      });

      // Non-blocking fire-and-forget analytics logging
      logAnalyticsEvent(
        user?.id || appState.farmerId,
        'query',
        botRes.advisory?.intent || 'general',
        appState.location,
        { hasAdvisory: Boolean(botRes.advisory) }
      );
    } catch {
      setMessages(m => [
        ...m,
        {
          id: `e-${Date.now()}`,
          sender: 'bot',
          text: 'Sorry, something went wrong.',
          timestamp: new Date(),
        },
      ]);
    }
    setIsThinking(false);
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.startListening(speech.detectedLang);
    }
  };

  const handleLangToggle = () => {
    const newLang = speech.toggleLang();
    if (speech.isListening) {
      speech.stopListening();
      setTimeout(() => speech.startListening(newLang), 300);
    }
  };

  const startNewChat = () => {
    const newId = `conv_${Date.now()}`;
    setCurrentConversationId(newId);
    setMessages([]);
    setAppState(s => ({
      ...s,
      sessionId: newId,
      turnIndex: 0,
      previousAdvisory: null
    }));
    setActiveTab('chat');
  };

  const loadPastConversation = (convId: string, pastMsgs: ChatMessageRecord[]) => {
    setCurrentConversationId(convId);
    const converted: Message[] = pastMsgs.map(pm => ({
      id: pm.id,
      sender: pm.sender,
      text: pm.content,
      timestamp: new Date(pm.created_at),
      advisory: pm.advisory,
      followUps: pm.advisory?.suggestedFollowUps || []
    }));
    setMessages(converted);
    setAppState(s => ({
      ...s,
      sessionId: convId,
      turnIndex: converted.length,
      previousAdvisory: converted[converted.length - 1]?.advisory || null
    }));
    setActiveTab('chat');
  };

  const currentLang = speech.detectedLang === 'kn-IN' ? 'kn' : 'en';

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)' }}>
        <div style={{ color: 'var(--accent)', fontWeight: '500' }}>Loading Maize Advisor...</div>
      </div>
    );
  }

  // Show login screen if not logged in and not guest
  if (!user && !isGuest) {
    return <AuthScreen onComplete={() => setActiveTab('chat')} />;
  }

  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: '100vh',
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
        boxShadow: '0 0 40px rgba(0,0,0,0.1)',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border)',
          zIndex: 10
        }}
      >
        <div style={{ fontSize: '24px' }}>🌾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '16px' }}>Maize Advisor</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isOnline ? '#22c55e' : '#eab308' }}>
              ● {isOnline ? 'Online' : 'Offline'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>{pendingSyncCount > 0 ? `⏳ Sync (${pendingSyncCount})` : '✅ Synced'}</span>
          </div>
        </div>
        <button
          onClick={handleLangToggle}
          title="Toggle speech language"
          style={{
            background: 'var(--surface-sunk)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control, 8px)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: '600',
            fontSize: '13px'
          }}
        >
          {speech.detectedLang === 'kn-IN' ? 'ಕನ್ನಡ' : 'EN'}
        </button>
      </header>

      {/* Main Tab View switcher */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ContextStrip profile={appState} lang={currentLang} />

            {/* ── Messages ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌽</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                    {currentLang === 'kn' ? 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಮೆಕ್ಕೆಜೋಳ ಬೆಳೆಯ ಬಗ್ಗೆ ಕೇಳಿ.' : 'Hello! Ask about your Maize crop.'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    {currentLang === 'kn'
                      ? 'ಉದಾಹರಣೆಗೆ: "ಇಂದು ನೀರು ಹಾಕಬೇಕೆ?", "ಪೈರು ಹಳದಿಯಾಗುತ್ತಿದೆ", "ಯೂರಿಯಾ ಗೊಬ್ಬರ ಎಷ್ಟು ಹಾಕಬೇಕು?"'
                      : 'Examples: "Should I irrigate today?", "Fall Armyworm symptoms", "Nitrogen dose"'}
                  </p>
                </div>
              ) : (
                messages.map((m, index) => (
                  <React.Fragment key={m.id}>
                    {m.sender === 'user' ? (
                      <div style={{ alignSelf: 'flex-end', background: 'var(--surface-sunk)', padding: '12px 16px', borderRadius: '16px 16px 0 16px', maxWidth: '85%' }} lang={currentLang} data-lang={currentLang}>
                        {m.text}
                      </div>
                    ) : (
                      <div style={{ alignSelf: 'flex-start', width: '100%', maxWidth: '100%' }}>
                        {/* Transcript Confirm if previous message was speech */}
                        {index > 0 && messages[index - 1].sender === 'user' && messages[index - 1].isTranscript && (
                          <TranscriptConfirm text={messages[index - 1].text} onEdit={() => setInput(messages[index - 1].text)} lang={currentLang} />
                        )}

                        {m.text && (
                          <div style={{ background: 'var(--surface-sunk)', padding: '12px 16px', borderRadius: '16px 16px 16px 0', maxWidth: '85%', marginBottom: m.advisory ? '12px' : '0' }} lang={currentLang} data-lang={currentLang}>
                            {parseMarkdown(m.text)}
                          </div>
                        )}

                        {m.advisory && (
                          <AdvisoryCard advisory={m.advisory} lang={currentLang} />
                        )}

                        {/* Chips */}
                        {m.followUps && m.followUps.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {m.followUps.map((fu, i) => (
                              <button
                                key={i}
                                onClick={() => handleSend(fu)}
                                style={{ background: 'var(--surface-sunk)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}
                              >
                                {fu}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))
              )}

              {isThinking && (
                <div style={{ alignSelf: 'flex-start', padding: '16px', background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
                  <span style={{ letterSpacing: '2px', color: 'var(--text-muted)' }}>•••</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Bar ── */}
            <div style={{ padding: '12px 16px', background: 'var(--surface-card)', borderTop: '1px solid var(--border)' }}>
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentLang === 'kn' ? 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ...' : 'Ask your question...'}
                  disabled={!isReady || isThinking}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface-sunk)', fontSize: '16px', outline: 'none' }}
                  onFocus={(e) => e.target.style.outline = '2px solid var(--accent)'}
                  onBlur={(e) => e.target.style.outline = 'none'}
                />
                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={handleMicToggle}
                    title={speech.isListening ? 'Stop listening' : 'Start voice input'}
                    aria-label={speech.isListening ? 'Stop listening' : 'Start voice input'}
                    style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: speech.isListening ? 'var(--accent)' : 'var(--surface-sunk)',
                      color: speech.isListening ? 'white' : 'var(--text-primary)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}
                  >
                    {speech.isListening ? <span>🛑</span> : <span>🎙️</span>}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || !isReady || isThinking}
                  aria-label="Send"
                  style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: input.trim() ? 'var(--accent)' : 'var(--surface-sunk)',
                    color: input.trim() ? 'white' : 'var(--text-muted)',
                    border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                  }}
                >
                  <span>➔</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab
            lang={currentLang}
            onNewChat={startNewChat}
            onSelectConversation={loadPastConversation}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            lang={currentLang}
            onProfileUpdated={(prof) => {
              setAppState(s => ({
                ...s,
                farmerId: prof.id,
                location: prof.location || 'Dharwad',
                stage: prof.crop_stage || 'V4'
              }));
            }}
          />
        )}
      </div>

      {/* ── Bottom Mobile / Web Navigation Bar ── */}
      <nav
        style={{
          display: 'flex',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border)',
          padding: '6px 0 calc(8px + env(safe-area-inset-bottom, 0px))',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10
        }}
      >
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'chat' ? 'var(--accent, #22c55e)' : 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '6px 0'
          }}
        >
          <span style={{ fontSize: '20px' }}>🌾</span>
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'chat' ? '600' : '400' }}>
            {currentLang === 'kn' ? 'ಸಲಹೆ (Advisory)' : 'Advisory'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'history' ? 'var(--accent, #22c55e)' : 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '6px 0'
          }}
        >
          <span style={{ fontSize: '20px' }}>📜</span>
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'history' ? '600' : '400' }}>
            {currentLang === 'kn' ? 'ಇತಿಹಾಸ (History)' : 'History'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'profile' ? 'var(--accent, #22c55e)' : 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '6px 0'
          }}
        >
          <span style={{ fontSize: '20px' }}>👤</span>
          <span style={{ fontSize: '11px', fontWeight: activeTab === 'profile' ? '600' : '400' }}>
            {currentLang === 'kn' ? 'ಪ್ರೊಫೈಲ್ (Profile)' : 'Profile'}
          </span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
