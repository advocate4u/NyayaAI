type OnlineAnswerResponse = { answer?: unknown; model?: unknown; error?: unknown };

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
export const onlineAiEndpoint = (env?.VITE_NYAYAI_AI_ENDPOINT ?? '').trim();

export function isOnlineAiConfigured(): boolean {
  return onlineAiEndpoint.length > 0;
}

export async function generateOnlineLegalAnswer(question: string, evidence: string): Promise<{ answer: string; model: string }> {
  if (!onlineAiEndpoint) throw new Error('Online AI is not configured. Set VITE_NYAYAI_AI_ENDPOINT to your secured server endpoint.');
  const response = await fetch(onlineAiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, evidence })
  });
  const payload = await response.json().catch(() => ({})) as OnlineAnswerResponse;
  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : 'The online AI service could not answer this request.';
    throw new Error(detail);
  }
  if (typeof payload.answer !== 'string' || !payload.answer.trim()) {
    throw new Error('The online AI service returned an empty answer.');
  }
  return {
    answer: payload.answer.trim(),
    model: typeof payload.model === 'string' ? payload.model : 'configured online model'
  };
}
