/**
 * Groq LLM integration via Vercel serverless proxy (/api/groq).
 * Fallback to direct client call if VITE_GROQ_API_KEY is explicitly present in dev.
 */

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function callGroq(
    conversationHistory: Array<{ role: 'user' | 'bot'; text: string }>,
    currentQuery: string,
    agronomicContext: string | null
): Promise<string> {
    try {
        const res = await fetch('/api/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'chat',
                conversationHistory,
                currentQuery,
                agronomicContext
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.content) return data.content;
        }
    } catch (err) {
        console.warn('/api/groq serverless route unavailable, trying fallback/rule engine text.', err);
    }

    // Direct fallback if VITE_GROQ_API_KEY exists (e.g., local standalone vite dev)
    const directKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (directKey) {
        try {
            const url = 'https://api.groq.com/openai/v1/chat/completions';
            const messages: ChatMessage[] = [];
            const recent = conversationHistory.slice(-6);
            for (const msg of recent) {
                messages.push({
                    role: msg.role === 'bot' ? 'assistant' : 'user',
                    content: msg.text
                });
            }
            let userContent = currentQuery;
            if (agronomicContext) {
                userContent = `[AGRONOMIC CONTEXT FROM RULE ENGINE]\n${agronomicContext}\n\n[FARMER'S QUESTION]\n${currentQuery}`;
            }
            messages.push({ role: 'user', content: userContent });

            const safeKey = directKey.replace(/[^\x20-\x7E]/g, '');
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${safeKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'system', content: 'You are a helpful Maize Crop Assistant for farmers in Karnataka.' }, ...messages],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });
            if (res.ok) {
                const data = await res.json();
                return data?.choices?.[0]?.message?.content || '';
            }
        } catch (e) {
            console.error('Direct Groq fallback failed', e);
        }
    }

    return '';
}

export async function callGroqNLU(utterance: string): Promise<any> {
    try {
        const res = await fetch('/api/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'nlu',
                utterance
            })
        });

        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('/api/groq NLU route failed/offline', e);
    }
    return null;
}
