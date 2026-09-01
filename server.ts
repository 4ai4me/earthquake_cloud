import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  GEMINI_MODELS,
  RequestValidationError,
  buildScriptPrompt,
  buildStateContext,
  callGemini,
  validateAnalyzeRequest,
  validateGenerateScriptRequest,
} from './shared/geminiApi';

dotenv.config();

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const isProductionMode = process.env.NODE_ENV === 'production' || path.basename(currentFile) === 'server.mjs';
const app = express();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb', strict: true }));

function allowedOrigins(): Set<string> {
  const configured = [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS ?? '').split(',')]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter((value): value is string => Boolean(value));
  if (!isProductionMode) {
    configured.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return new Set(configured);
}

function protectApi(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  const origins = allowedOrigins();
  if (origin && !origins.has(origin.replace(/\/$/, ''))) {
    return res.status(403).json({ error: '허용되지 않은 웹사이트에서 보낸 요청입니다.' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Turnstile-Token');
    return res.sendStatus(204);
  }

  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type은 application/json이어야 합니다.' });
  }

  const now = Date.now();
  const key = req.ip || 'unknown';
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else if (bucket.count >= 10) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)).toString());
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  } else {
    bucket.count += 1;
  }
  next();
}

function requireApiKey(res: Response): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: 'AI 분석 서버가 아직 구성되지 않았습니다.' });
    return null;
  }
  return apiKey;
}

function sendApiError(res: Response, error: unknown) {
  if (error instanceof RequestValidationError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return res.status(504).json({ error: 'AI 분석 서버의 응답 시간이 초과되었습니다.' });
  }
  const upstreamStatus = (error as { status?: unknown })?.status;
  if (upstreamStatus === 429) {
    return res.status(429).json({ error: 'Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' });
  }
  console.error('Gemini request failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    status: typeof upstreamStatus === 'number' ? upstreamStatus : undefined,
  });
  return res.status(502).json({ error: 'AI 분석 서비스와 통신하지 못했습니다.' });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', geminiConfigured: Boolean(process.env.GEMINI_API_KEY), timestamp: new Date().toISOString() });
});

app.options('/api/*', protectApi);
app.use('/api/gemini', protectApi);

app.post('/api/gemini/analyze', async (req, res) => {
  const apiKey = requireApiKey(res);
  if (!apiKey) return;
  try {
    const request = validateAnalyzeRequest(req.body);
    const model = GEMINI_MODELS[request.modelPreference];
    const result = await callGemini({
      apiKey,
      model,
      prompt: `${request.prompt}${buildStateContext(request.simulationState)}`,
      enableThinking: request.enableThinking,
    });
    res.json({ text: result.text, model, usage: result.usage });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.post('/api/gemini/generate-script', async (req, res) => {
  const apiKey = requireApiKey(res);
  if (!apiKey) return;
  try {
    const request = validateGenerateScriptRequest(req.body);
    const result = await callGemini({
      apiKey,
      model: GEMINI_MODELS.flash,
      prompt: buildScriptPrompt(request),
    });
    res.json({ code: result.text, model: GEMINI_MODELS.flash, usage: result.usage });
  } catch (error) {
    sendApiError(res, error);
  }
});

async function start() {
  if (!isProductionMode) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = currentDirectory;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Earthquake-cloud hypothesis simulator listening on http://0.0.0.0:${port}`);
  });
}

start().catch((error) => {
  console.error('Server startup failed', error);
  process.exitCode = 1;
});
