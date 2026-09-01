const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, '');

export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? '';

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
  }
}

export function isGeminiApiConfigured(): boolean {
  return Boolean(configuredBaseUrl) || !window.location.hostname.endsWith('github.io');
}

function endpoint(path: string): string {
  return configuredBaseUrl ? `${configuredBaseUrl}${path}` : path;
}

export async function requestGemini<T>(
  path: '/api/gemini/analyze' | '/api/gemini/generate-script',
  body: unknown,
  turnstileToken?: string | null
): Promise<T> {
  if (!isGeminiApiConfigured()) {
    throw new GeminiApiError('GitHub Pages용 AI 백엔드 주소가 아직 설정되지 않았습니다.');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (turnstileToken) headers['X-Turnstile-Token'] = turnstileToken;
    const response = await fetch(endpoint(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (!response.ok) {
      throw new GeminiApiError(
        typeof data?.error === 'string' ? data.error : `AI 서버 요청이 실패했습니다. (${response.status})`,
        response.status
      );
    }
    if (!data) throw new GeminiApiError('AI 서버가 올바른 JSON 응답을 반환하지 않았습니다.');
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GeminiApiError('AI 서버 응답 시간이 초과되었습니다.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
