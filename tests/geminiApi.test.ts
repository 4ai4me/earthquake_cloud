import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PROMPT_LENGTH,
  RequestValidationError,
  buildScriptPrompt,
  buildStateContext,
  callGemini,
  validateAnalyzeRequest,
  validateGenerateScriptRequest,
} from '../shared/geminiApi';

test('analyze request accepts bounded numeric simulation data', () => {
  const request = validateAnalyzeRequest({
    prompt: '현재 상태를 대조군과 비교해 주세요.',
    modelPreference: 'pro',
    enableThinking: true,
    simulationState: {
      earthMoment: 1,
      earthTilt: 11.5,
      sources: [{ type: 'dipole', x: 2, y: 1, strength: 3, angle: 15 }],
      imfBx: 1,
      imfBz: -2,
      alignmentOrder: 0.2,
    },
  });

  assert.equal(request.modelPreference, 'pro');
  assert.equal(request.simulationState?.sources.length, 1);
  assert.match(buildStateContext(request.simulationState), /<simulation_state_data>/);
});

test('analyze request rejects oversized prompts and non-finite values', () => {
  assert.throws(
    () => validateAnalyzeRequest({ prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1) }),
    RequestValidationError
  );
  assert.throws(
    () => validateAnalyzeRequest({ prompt: 'ok', simulationState: { sources: [], earthMoment: Number.NaN } }),
    RequestValidationError
  );
});

test('script prompt explicitly includes a null model and hypothesis labeling', () => {
  const request = validateGenerateScriptRequest({
    customizationRequest: '민감도 분석을 추가해 주세요.',
    simulationState: { sources: [] },
  });
  const prompt = buildScriptPrompt(request);
  assert.match(prompt, /null\/control run/i);
  assert.match(prompt, /hypothesis/i);
  assert.match(prompt, /Do not claim that the output validates earthquake prediction/i);
});

test('Gemini 3 request uses supported thinking level without deprecated sampling parameters', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await callGemini({ apiKey: 'test-key', model: 'gemini-3.7-flash', prompt: 'test' });
    assert.equal(result.text, 'ok');
    assert.equal(requestBody?.generationConfig?.thinkingConfig?.thinkingLevel, 'low');
    assert.equal('temperature' in (requestBody?.generationConfig ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
