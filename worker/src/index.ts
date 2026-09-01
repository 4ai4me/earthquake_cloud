import {
  GEMINI_MODELS,
  RequestValidationError,
  buildScriptPrompt,
  buildStateContext,
  callGemini,
  validateAnalyzeRequest,
  validateGenerateScriptRequest,
} from '../../shared/geminiApi';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  GEMINI_API_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  ALLOWED_ORIGINS: string;
  REQUIRE_TURNSTILE?: string;
  GEMINI_RATE_LIMITER?: RateLimiter;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body: unknown, status = 200, origin?: string): Response {
  const headers = new Headers(JSON_HEADERS);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin')?.replace(/\/$/, '');
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim().replace(/\/$/, ''));
  return allowed.includes(origin) ? origin : null;
}

async function verifyTurnstile(request: Request, env: Env): Promise<boolean> {
  if (env.REQUIRE_TURNSTILE !== 'true') return true;
  if (!env.TURNSTILE_SECRET_KEY) return false;
  const token = request.headers.get('X-Turnstile-Token');
  if (!token || token.length > 2_048) return false;

  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
  return response.ok && result?.success === true;
}

function safeError(error: unknown, origin: string): Response {
  if (error instanceof RequestValidationError) return json({ error: error.message }, 400, origin);
  if (error instanceof Error && error.name === 'AbortError') {
    return json({ error: 'AI 분석 서버의 응답 시간이 초과되었습니다.' }, 504, origin);
  }
  const upstreamStatus = (error as { status?: unknown })?.status;
  if (upstreamStatus === 429) {
    return json({ error: 'Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' }, 429, origin);
  }
  console.error('Gemini proxy request failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    status: typeof upstreamStatus === 'number' ? upstreamStatus : undefined,
  });
  return json({ error: 'AI 분석 서비스와 통신하지 못했습니다.' }, 502, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = getAllowedOrigin(request, env);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ status: 'ok', geminiConfigured: Boolean(env.GEMINI_API_KEY), timestamp: new Date().toISOString() });
    }

    if (!url.pathname.startsWith('/api/gemini/')) return json({ error: '찾을 수 없는 API 경로입니다.' }, 404);
    if (!origin) return json({ error: '허용되지 않은 웹사이트에서 보낸 요청입니다.' }, 403);

    if (request.method === 'OPTIONS') {
      const headers = new Headers(JSON_HEADERS);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Turnstile-Token');
      headers.set('Access-Control-Max-Age', '86400');
      headers.set('Vary', 'Origin');
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') return json({ error: '지원하지 않는 요청 방식입니다.' }, 405, origin);
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
      return json({ error: 'Content-Type은 application/json이어야 합니다.' }, 415, origin);
    }
    const contentLength = Number(request.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 65_536) {
      return json({ error: '요청 본문이 너무 큽니다.' }, 413, origin);
    }
    if (!env.GEMINI_API_KEY) return json({ error: 'AI 분석 서버가 아직 구성되지 않았습니다.' }, 503, origin);

    if (env.GEMINI_RATE_LIMITER) {
      const actor = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
      const rate = await env.GEMINI_RATE_LIMITER.limit({ key: `${actor}:${url.pathname}` });
      if (!rate.success) return json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, 429, origin);
    }
    if (!(await verifyTurnstile(request, env))) {
      return json({ error: '자동화 요청 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' }, 403, origin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: '올바른 JSON 요청이 아닙니다.' }, 400, origin);
    }

    try {
      if (url.pathname === '/api/gemini/analyze') {
        const input = validateAnalyzeRequest(body);
        const model = GEMINI_MODELS[input.modelPreference];
        const result = await callGemini({
          apiKey: env.GEMINI_API_KEY,
          model,
          prompt: `${input.prompt}${buildStateContext(input.simulationState)}`,
          enableThinking: input.enableThinking,
        });
        return json({ text: result.text, model, usage: result.usage }, 200, origin);
      }

      if (url.pathname === '/api/gemini/generate-script') {
        const input = validateGenerateScriptRequest(body);
        const result = await callGemini({
          apiKey: env.GEMINI_API_KEY,
          model: GEMINI_MODELS.flash,
          prompt: buildScriptPrompt(input),
        });
        return json({ code: result.text, model: GEMINI_MODELS.flash, usage: result.usage }, 200, origin);
      }
      return json({ error: '찾을 수 없는 API 경로입니다.' }, 404, origin);
    } catch (error) {
      return safeError(error, origin);
    }
  },
};
