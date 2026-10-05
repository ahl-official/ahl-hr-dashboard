// Tiny in-memory limiter for the public joiner endpoints. Per server instance, which is enough to blunt
// casual guessing/abuse; use a shared store (Redis/Upstash) if the app is ever scaled out.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
