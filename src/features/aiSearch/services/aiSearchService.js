// Natural-language search (FastAPI -> Gemini). Server-side it is validated, grounded in the real
// catalog, rate limited, and falls back to keyword matching when the AI is unavailable.
import { apiClient } from '../../../services/apiClient';

export const AI_QUERY_MIN = 3;
export const AI_QUERY_MAX = 200; // keep in sync with MAX_QUERY_LENGTH in services/ai_search_service.py
const AI_TIMEOUT_MS = 28000; // the shared client allows 10s; the AI call is given a little longer

// kind: 'rate_limited' | 'invalid' | 'failed'
export class AiSearchError extends Error {
  constructor(kind, message, retryAfter = 0) {
    super(message);
    this.name = 'AiSearchError';
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

export const isCanceled = (err) => err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';

// Resolves { query, matches, fallback_used, fallback_reason, retry_after_seconds, message }
export async function aiSearch(query, { signal, limit = 5 } = {}) {
  try {
    const res = await apiClient.post('/api/ai-search', { query, limit }, { signal, timeout: AI_TIMEOUT_MS });
    return res.data;
  } catch (err) {
    if (isCanceled(err)) throw err;
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    if (status === 429) {
      throw new AiSearchError(
        'rate_limited',
        detail?.message || 'Too many searches. Please wait a moment.',
        Number(detail?.retry_after_seconds) || 30,
      );
    }
    if (status === 422) throw new AiSearchError('invalid', 'That question could not be searched. Try rewording it.');
    console.error('[LOOKit AI Search] Request failed:', err);
    throw new AiSearchError('failed', 'Smart search could not be reached. Check your connection and try again.');
  }
}
