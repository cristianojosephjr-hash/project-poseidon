type CacheEntry = {
  value: string;
  createdAt: number;
};

const promptCache = new Map<string, CacheEntry>();

export function resolveCachedPrompt(key: string, createPrompt: () => string): {
  prompt: string;
  hit: boolean;
  key: string;
} {
  const existing = promptCache.get(key);
  if (existing) {
    return { prompt: existing.value, hit: true, key };
  }
  const prompt = createPrompt();
  promptCache.set(key, { value: prompt, createdAt: Date.now() });
  return { prompt, hit: false, key };
}

export function snapshotPromptCache(): { key: string; ageMs: number }[] {
  const now = Date.now();
  return [...promptCache.entries()].map(([key, entry]) => ({
    key,
    ageMs: now - entry.createdAt,
  }));
}

