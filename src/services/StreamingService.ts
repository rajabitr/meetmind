import { AIProviderConfig } from '../types';

type OnChunk = (text: string) => void;

export class StreamingService {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async streamAnswer(
    prompt: string,
    model: string,
    onChunk: OnChunk
  ): Promise<string> {
    switch (this.config.provider) {
      case 'claude':
        return this.streamClaude(prompt, model, onChunk);
      case 'openai':
        return this.streamOpenAI(prompt, model, onChunk);
      case 'gemini':
        return this.streamGemini(prompt, model, onChunk);
    }
  }

  private async streamClaude(
    prompt: string,
    model: string,
    onChunk: OnChunk
  ): Promise<string> {
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
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude streaming error: ${res.status} ${err}`);
    }

    return this.readSSEStream(res, (event, data) => {
      if (event === 'content_block_delta' && data.delta?.text) {
        onChunk(data.delta.text);
      }
    });
  }

  private async streamOpenAI(
    prompt: string,
    model: string,
    onChunk: OnChunk
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI streaming error: ${res.status} ${err}`);
    }

    return this.readSSEStream(res, (_event, data) => {
      if (data === '[DONE]') return;
      const delta = data.choices?.[0]?.delta?.content;
      if (delta) onChunk(delta);
    });
  }

  private async streamGemini(
    prompt: string,
    model: string,
    onChunk: OnChunk
  ): Promise<string> {
    // Gemini uses streamGenerateContent with alt=sse
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`,
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
      throw new Error(`Gemini streaming error: ${res.status} ${err}`);
    }

    return this.readSSEStream(res, (_event, data) => {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) onChunk(text);
    });
  }

  private async readSSEStream(
    response: Response,
    onEvent: (event: string, data: any) => void
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const data = JSON.parse(raw);
            onEvent(currentEvent, data);

            // Extract text for full response
            if (currentEvent === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text;
            } else if (data.choices?.[0]?.delta?.content) {
              fullText += data.choices[0].delta.content;
            } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              fullText += data.candidates[0].content.parts[0].text;
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    }

    return fullText;
  }
}
