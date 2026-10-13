export type LocalLegalEngine = {
  modelId: string;
  answer: (question: string, evidence: string) => Promise<string>;
};

export async function createLocalLegalEngine(onProgress: (message: string) => void): Promise<LocalLegalEngine> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    throw new Error('This browser does not expose WebGPU. Offline legal search will still work, but local AI needs a compatible browser and GPU.');
  }

  onProgress('Loading the local AI runtime…');
  const webllm = await import('@mlc-ai/web-llm');
  const models = webllm.prebuiltAppConfig.model_list;
  const model = models.find((item) => /Qwen2.*0\.5B.*Instruct.*q4f16_1/i.test(item.model_id))
    ?? models.find((item) => /Qwen2.*0\.5B.*Instruct/i.test(item.model_id));

  if (!model) {
    throw new Error('A supported small Qwen 0.5B instruct model was not found in this WebLLM build. Offline search is still available.');
  }

  onProgress('Preparing ' + model.model_id + '. The first download can be large; keep this page open and connected to Wi-Fi if possible.');
  const engine = await webllm.CreateMLCEngine(model.model_id, {
    appConfig: { ...webllm.prebuiltAppConfig, cacheBackend: 'indexeddb' },
    initProgressCallback: (report) => {
      onProgress(typeof report.text === 'string' ? report.text : 'Loading local model…');
    }
  });

  return {
    modelId: model.model_id,
    answer: async (question: string, evidence: string) => {
      const response = await engine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: [
              'You are NyayaAI, an Indian legal research assistant.',
              'Answer only from the supplied evidence. Do not invent statutes, section numbers, case names, citations, holdings or quotations.',
              'Cite each material legal proposition using the evidence labels such as [1] or [2].',
              'If the evidence is incomplete, outdated, conflicting or does not answer the question, say so plainly and ask for verification against current authoritative law.',
              'Distinguish a direct quotation from a summary. Do not claim to be a lawyer or give a guaranteed legal outcome.',
              'Respond in the language of the question when feasible.'
            ].join(' ')
          },
          {
            role: 'user',
            content: 'QUESTION:\n' + question + '\n\nVERIFIED-STATUS UNKNOWN: the passages below were imported by the user and have not been independently authenticated by NyayaAI.\n\nEVIDENCE:\n' + evidence
          }
        ],
        temperature: 0.1,
        max_tokens: 600
      });
      const answer = response.choices[0]?.message.content;
      return typeof answer === 'string' && answer.trim() ? answer.trim() : 'The local model returned no text. Please try again or use the cited source passages directly.';
    }
  };
}
