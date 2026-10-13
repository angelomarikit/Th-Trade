/** Normalize Railway/.env mistakes (key + OPENAI_MODEL pasted on one line). */
export function readOpenAiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  let raw = (env.OPENAI_API_KEY ?? "").trim();
  if (!raw) return "";
  raw = raw.split(/\r?\n/)[0] ?? raw;
  raw = raw.split(/\s*OPENAI_MODEL\s*=/i)[0] ?? raw;
  return raw.trim().replace(/\s+/g, "");
}

export function readOpenAiModel(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = (env.OPENAI_MODEL ?? "").trim().split(/\r?\n/)[0]?.trim();
  if (explicit) return explicit;
  const combined = env.OPENAI_API_KEY ?? "";
  const fromKey = combined.match(/OPENAI_MODEL\s*=\s*(\S+)/i)?.[1];
  return fromKey?.trim() || "gpt-4o-mini";
}

export function openAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readOpenAiApiKey(env).length > 0;
}
