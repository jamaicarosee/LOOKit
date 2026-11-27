import { useCallback, useEffect, useRef, useState } from 'react';
import { aiSearch, isCanceled, AI_QUERY_MIN, AI_QUERY_MAX } from '../services/aiSearchService';
import { search as searchLocations } from '../../navigation/services/locationService';

const MIN_GAP_MS = 800; // ignore a second submit that arrives right after the first
const CACHE_LIMIT = 20;
const IDLE = { status: 'idle', open: false, query: '', matches: [], notice: null, error: null, fallbackUsed: false };

const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();

// Existing keyword search, reshaped like AI matches (used when the AI is rate limited)
const toKeywordMatches = (locations) =>
  locations.map((loc) => ({ id: String(loc.id), category: 'location', reason: 'Matches your keywords', confidence: null, item: loc }));

// Natural-language search. Runs ONLY when submit() is called (button / Enter), never per keystroke.
// status: 'idle' | 'loading' | 'ready' | 'rate_limited' | 'error'
export default function useAiSearch() {
  const [state, setState] = useState(IDLE);
  const requestId = useRef(0);
  const controller = useRef(null);
  const lastQuery = useRef('');
  const lastSubmitAt = useRef(0);
  const cooldownUntil = useRef(0);
  const cache = useRef(new Map()); // this session only: the same question is not sent twice

  useEffect(() => () => controller.current?.abort(), []);

  const keywordFallback = useCallback(async (query) => {
    try {
      return toKeywordMatches(await searchLocations(query, { limit: 5 }));
    } catch {
      return [];
    }
  }, []);

  const submit = useCallback(async (raw, { force = false } = {}) => {
    const query = clean(raw);
    lastQuery.current = query;

    if (query.length < AI_QUERY_MIN || query.length > AI_QUERY_MAX) {
      setState({
        ...IDLE, open: true, status: 'error', query,
        error: query.length < AI_QUERY_MIN
          ? `Type at least ${AI_QUERY_MIN} characters, e.g. “registrar on the 2nd floor”.`
          : `Keep it under ${AI_QUERY_MAX} characters.`,
      });
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState({
        ...IDLE,
        open: true,
        status: 'error',
        query,
        error: 'AI Smart Search requires an internet connection.',
      });
      return;
    }

    const key = query.toLowerCase();
    if (!force && cache.current.has(key)) {
      setState({ ...cache.current.get(key), open: true });
      return;
    }
    if (Date.now() - lastSubmitAt.current < MIN_GAP_MS) return;
    lastSubmitAt.current = Date.now();

    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const id = ++requestId.current;

    // Told to slow down earlier: do not call the server again until the wait is over
    const wait = Math.ceil((cooldownUntil.current - Date.now()) / 1000);
    if (wait > 0) {
      setState({ ...IDLE, open: true, status: 'loading', query });
      const matches = await keywordFallback(query);
      if (id !== requestId.current) return;
      setState({
        ...IDLE, open: true, status: 'rate_limited', query, matches, fallbackUsed: true,
        notice: `Too many searches. Showing keyword matches; Smart search is back in ${wait}s.`,
      });
      return;
    }

    setState({ ...IDLE, open: true, status: 'loading', query });
    try {
      const data = await aiSearch(query, { signal: ctrl.signal });
      if (id !== requestId.current) return;
      const next = {
        ...IDLE, open: true, status: 'ready', query,
        matches: data.matches || [],
        fallbackUsed: !!data.fallback_used,
        notice: data.fallback_used ? data.message || 'Smart search is unavailable, so keyword matching was used.' : null,
      };
      if (!next.fallbackUsed) {
        if (cache.current.size >= CACHE_LIMIT) cache.current.delete(cache.current.keys().next().value);
        cache.current.set(key, next);
      }
      setState(next);
    } catch (err) {
      if (isCanceled(err) || id !== requestId.current) return;
      if (err.kind === 'rate_limited') {
        cooldownUntil.current = Date.now() + err.retryAfter * 1000;
        const matches = await keywordFallback(query);
        if (id !== requestId.current) return;
        setState({
          ...IDLE, open: true, status: 'rate_limited', query, matches, fallbackUsed: true,
          notice: `Too many searches. Showing keyword matches; try Smart search again in ${err.retryAfter}s.`,
        });
        return;
      }
      setState({ ...IDLE, open: true, status: 'error', query, error: err.message || 'Smart search failed.' });
    }
  }, [keywordFallback]);

  const retry = useCallback(() => submit(lastQuery.current, { force: true }), [submit]);

  // Hides the panel; a request still in flight is cancelled
  const close = useCallback(() => {
    controller.current?.abort();
    requestId.current += 1;
    setState((s) => ({ ...s, open: false, status: s.status === 'loading' ? 'idle' : s.status }));
  }, []);

  const showNotice = useCallback((notice) => setState((s) => ({ ...s, notice })), []);

  return { ...state, submit, retry, close, showNotice };
}
