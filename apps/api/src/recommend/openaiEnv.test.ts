import { describe, expect, it } from "vitest";
import { openAiConfigured, readOpenAiApiKey, readOpenAiModel } from "./openaiEnv.js";

describe("readOpenAiApiKey", () => {
  it("strips OPENAI_MODEL accidentally pasted on the same Railway variable", () => {
    const env = {
      OPENAI_API_KEY: "sk-test-key\nOPENAI_MODEL=gpt-4o-mini",
    };
    expect(readOpenAiApiKey(env)).toBe("sk-test-key");
    expect(readOpenAiModel(env)).toBe("gpt-4o-mini");
  });

  it("prefers dedicated OPENAI_MODEL variable", () => {
    const env = {
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_MODEL: "gpt-4o",
    };
    expect(readOpenAiModel(env)).toBe("gpt-4o");
    expect(openAiConfigured(env)).toBe(true);
  });
});
