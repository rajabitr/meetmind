import { AIProviderConfig } from '../types';
import { AI_MODELS } from '../config/constants';
import { StreamingService } from './StreamingService';

interface AIResponse {
  content: string;
}

export class AIProviderService {
  private config: AIProviderConfig;
  private streaming: StreamingService;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.streaming = new StreamingService(config);
  }

  async detectQuestion(
    recentTranscript: string,
    lastSegment: string
  ): Promise<boolean> {
    const prompt = `You are analyzing a meeting/interview transcript. Determine if the last statement requires the user to respond. Answer ONLY "YES" or "NO".

Say YES for ANY of these:
- Direct questions ("What do you think?", "How would you handle this?")
- Indirect questions ("Tell me about...", "Walk me through...")
- Invitations to speak ("If you want to add anything...", "Go ahead", "Anything else?", "Feel free to elaborate")
- Open-ended prompts ("Let's hear your thoughts", "Over to you")
- Requests for opinion or input ("I'd love your perspective", "What's your take?")
- Prompts expecting a response even without a question mark

Say NO only if the speaker is clearly making a statement that does NOT expect a response.

Recent context:
${recentTranscript}

Last statement:
${lastSegment}`;

    const response = await this.callAI(prompt, 'fast');
    return response.content.trim().toUpperCase().includes('YES');
  }

  async generateAnswer(
    fullTranscript: string,
    question: string,
    topic: string,
    userRole: string
  ): Promise<string> {
    const prompt = `You are helping someone in a meeting. Based on the meeting transcript, generate a professional, detailed answer to the question being asked.

Meeting topic: ${topic || 'General meeting'}
Your role: ${userRole || 'Team member'}

Full transcript so far:
${fullTranscript}

Question asked: ${question}

Generate a clear, professional answer with specific details when possible. Keep it concise but thorough (2-4 sentences). Do NOT prefix with "Answer:" or similar.`;

    const response = await this.callAI(prompt, 'smart');
    return response.content;
  }

  async generateAnswerStreaming(
    fullTranscript: string,
    question: string,
    topic: string,
    userRole: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const prompt = `You are helping someone in a meeting. Based on the meeting transcript, generate a professional, detailed answer to the question being asked.

Meeting topic: ${topic || 'General meeting'}
Your role: ${userRole || 'Team member'}

Full transcript so far:
${fullTranscript}

Question asked: ${question}

Generate a clear, professional answer with specific details when possible. Keep it concise but thorough (2-4 sentences). Do NOT prefix with "Answer:" or similar.`;

    // React Native doesn't support ReadableStream for SSE,
    // so fall back to non-streaming and deliver result at once
    try {
      const model = this.config.smartModel;
      const result = await this.streaming.streamAnswer(prompt, model, onChunk);
      return result;
    } catch {
      // Fallback: non-streaming
      const response = await this.callAI(prompt, 'smart');
      onChunk(response.content);
      return response.content;
    }
  }

  async generateSummary(fullTranscript: string): Promise<string> {
    const prompt = `Summarize this meeting transcript. Include:

1. **Overview** - 2-3 sentence summary
2. **Key Points** - Bullet list of important items discussed
3. **Action Items** - Tasks assigned with owners if mentioned
4. **Open Questions** - Unresolved questions

Transcript:
${fullTranscript}`;

    const response = await this.callAI(prompt, 'smart');
    return response.content;
  }

  async translateText(text: string, targetLang: string): Promise<string> {
    const langNames: Record<string, string> = {
      en: 'English', fa: 'Persian', ar: 'Arabic', fr: 'French',
      de: 'German', es: 'Spanish', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', tr: 'Turkish',
    };
    const langName = langNames[targetLang] || targetLang;
    const prompt = `Translate the following text to ${langName}. Return ONLY the translation, nothing else.\n\n${text}`;
    const response = await this.callAI(prompt, 'fast');
    return response.content;
  }

  private async callAI(
    prompt: string,
    tier: 'fast' | 'smart'
  ): Promise<AIResponse> {
    const model = tier === 'fast' ? this.config.fastModel : this.config.smartModel;

    switch (this.config.provider) {
      case 'claude':
        return this.callClaude(prompt, model);
      case 'openai':
        return this.callOpenAI(prompt, model);
      case 'gemini':
        return this.callGemini(prompt, model);
    }
  }

  private async callClaude(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return { content: data.content[0].text };
  }

  private async callOpenAI(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return { content: data.choices[0].message.content };
  }

  private async callGemini(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return { content: data.candidates[0].content.parts[0].text };
  }
}
