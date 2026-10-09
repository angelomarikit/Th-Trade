export type PlanTier = "free" | "basic" | "standard" | "premium" | "ultra";

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  priceMonthlyUsd: number;
  creditsPerMonth: number;
  aiEnabled: boolean;
  aiCreditCost: number;
  deepAiCreditCost: number;
  maxWatchlist: number;
  description: string;
  features: string[];
  /** Stripe Price ID — wire later */
  stripePriceIdEnv: string;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    creditsPerMonth: 20,
    aiEnabled: true,
    aiCreditCost: 5,
    deepAiCreditCost: 15,
    maxWatchlist: 3,
    description: "Explore the terminal. Starter credits unlock model Signal Recommendation briefs.",
    features: [
      "Scanner + confirmation matrix",
      "Charts (1m/5m/15m/1D)",
      "20 starter credits for model briefs",
    ],
    stripePriceIdEnv: "",
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceMonthlyUsd: 99,
    creditsPerMonth: 100,
    aiEnabled: true,
    aiCreditCost: 5,
    deepAiCreditCost: 15,
    maxWatchlist: 5,
    description: "Core signals with limited Signal Recommendation unlocks.",
    features: [
      "Everything in Free",
      "Signal Recommendations",
      "100 credits / month",
      "5-symbol watchlist",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_BASIC",
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceMonthlyUsd: 250,
    creditsPerMonth: 400,
    aiEnabled: true,
    aiCreditCost: 5,
    deepAiCreditCost: 15,
    maxWatchlist: 25,
    description: "Active traders — Signal Recommendations + historical edge.",
    features: [
      "Everything in Basic",
      "400 credits / month",
      "25-symbol watchlist",
      "Historical edge + journal",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_STANDARD",
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceMonthlyUsd: 500,
    creditsPerMonth: 1200,
    aiEnabled: true,
    aiCreditCost: 5,
    deepAiCreditCost: 12,
    maxWatchlist: 100,
    description: "High-volume scanning with deeper Signal Recommendation briefs.",
    features: [
      "Everything in Standard",
      "1,200 credits / month",
      "Deep Signal Recommendation briefs",
      "Morning multi-ticker briefs (soon)",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_PREMIUM",
  },
  ultra: {
    id: "ultra",
    name: "Ultra Premium",
    priceMonthlyUsd: 1000,
    creditsPerMonth: 4000,
    aiEnabled: true,
    aiCreditCost: 4,
    deepAiCreditCost: 10,
    maxWatchlist: 500,
    description: "Desk-level access for power users and small teams.",
    features: [
      "Everything in Premium",
      "4,000 credits / month",
      "Lowest Signal Recommendation credit cost",
      "Team seats / API (Stripe phase)",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_ULTRA",
  },
};

export const PAID_TIERS: PlanTier[] = ["basic", "standard", "premium", "ultra"];

export function getPlan(tier: string | null | undefined): PlanDefinition {
  if (tier && tier in PLANS) return PLANS[tier as PlanTier];
  return PLANS.free;
}
