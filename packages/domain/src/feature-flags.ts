export interface FeatureFlags {
  /** Phase F — options contract engine. Must stay false until underlying validated. */
  optionsEngine: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  optionsEngine: false,
};

export function loadFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    optionsEngine: env.FEATURE_OPTIONS_ENGINE === "true",
  };
}
