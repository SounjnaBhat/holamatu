import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a helpful, practical Maize Crop Assistant for farmers in the Dharwad district of Karnataka.

CORE RULES:
1. STRICT GROUNDING: If AGRONOMIC CONTEXT is provided, you MUST base your answer ENTIRELY on those facts. Do not invent doses, dates, or rules. If the context says wait, say wait. If it gives a specific mm of water, use that exact number.
2. TONE: Speak like a knowledgeable local farmer or friendly extension worker. Keep it simple, practical, and easy to understand. Avoid overly corporate, academic, or robotic language.
3. LANGUAGE: Reply naturally in whatever language the farmer uses (English, Kannada/ಕನ್ನಡ, or romanized Kannada like "neeru hakbeka").
4. CONCISENESS: Farmers are busy in the field. Give the answer directly in 2-4 short sentences.
5. IF NO CONTEXT IS PROVIDED: If they ask a general maize farming question not in the context, answer based on standard practices for North Karnataka. If it's unrelated to farming, politely redirect.
6. FORMATTING: Use bullet points or a single emoji (like 💧, 🐛, 🌱, ⚠️) to make it easy to read on a cheap smartphone screen in the sun.`;

const NLU_PROMPT = `You are an NLU intent extractor for a Maize farming app. 
Analyze the farmer's utterance and extract the intent and slots.
Allowed Intents: irrigation_advice, pest_management, fertilizer_dose, explain_why, alternative, challenge, consequence, greeting_smalltalk, market_price, provide_info, unknown.
Return ONLY valid JSON matching this schema:
{
  "intent": "string",
  "intentConfidence": 0.99,
  "lang": "en" | "kn",
  "slots": {
    "location": { "value": "string" },
    "stage": { "value": "string" },
    "pest": { "value": "string" },
    "soil": { "value": "string" }
  }
}
If there are no slots, leave the slots object empty.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY server environment variable is missing' });
  }

  try {
    const { mode, conversationHistory, currentQuery, agronomicContext, utterance } = req.body || {};

    if (mode === 'nlu') {
      const body = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: NLU_PROMPT },
          { role: 'user', content: utterance || '' }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      };

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify(body)
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return res.status(groqRes.status).json({ error: `Groq NLU API error: ${errText}` });
      }

      const data = await groqRes.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(rawContent);
        return res.status(200).json(parsed);
      } catch (e) {
        return res.status(200).json({ intent: 'unknown', intentConfidence: 0.5, slots: {} });
      }
    }

    // Default mode: Chat LLM completion
    const messages: Array<{ role: string; content: string }> = [];
    const recent = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];
    for (const msg of recent) {
      messages.push({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.text || msg.content || ''
      });
    }

    let userContent = currentQuery || '';
    if (agronomicContext) {
      userContent = `[AGRONOMIC CONTEXT FROM RULE ENGINE — ground your answer in these facts]\n${agronomicContext}\n\n[FARMER'S QUESTION]\n${currentQuery}`;
    }
    messages.push({ role: 'user', content: userContent });

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(body)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: `Groq Chat API error: ${errText}` });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: reply });
  } catch (error: any) {
    console.error('Serverless Groq Proxy Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
