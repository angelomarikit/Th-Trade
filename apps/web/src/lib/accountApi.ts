import type { Session } from "@supabase/supabase-js";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export interface PlanInfo {
  id: string;
  name: string;
  priceMonthlyUsd: number;
  creditsPerMonth: number;
  aiEnabled: boolean;
  aiCreditCost: number;
  deepAiCreditCost: number;
  maxWatchlist: number;
  description: string;
  features: string[];
}

export interface ProfileInfo {
  id: string;
  email: string | null;
  display_name: string | null;
  plan_tier: string;
  credits_balance: number;
  credits_reset_at: string | null;
}

export interface MeResponse {
  user: { id: string; email?: string };
  profile: ProfileInfo;
  plan: PlanInfo;
  accountEnvironment: string;
}

export interface RecommendResponse {
  id: string | null;
  recommendation: string;
  confidence: string;
  reasons: string[];
  blockers: string[];
  brief: string;
  creditsCharged: number;
  creditsRemaining: number;
  plan: string;
  source?: string;
  setup?: {
    status: string;
    dataFresh: boolean;
    conditionsPassed: number;
    conditionsTotal: number;
    lastPrice: number;
    rewardToRisk: number;
    setupScore: number;
    alertAt: number;
    entryZone: { low: number; high: number; executable: boolean };
    stop: number;
    t1: number;
    t2: number;
    evaluatedAt: string;
  };
  openaiUsed: boolean;
  disclaimer: string;
}

async function authedFetch<T>(
  path: string,
  session: Session,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body as T;
}

export function fetchMe(session: Session) {
  return authedFetch<MeResponse>("/v1/me", session);
}

export function fetchPlans() {
  return fetch(`${API_BASE}/v1/plans`).then(async (res) => {
    if (!res.ok) throw new Error(`Plans HTTP ${res.status}`);
    return res.json() as Promise<{ plans: PlanInfo[] }>;
  });
}

export function selectPlan(session: Session, plan: string) {
  return authedFetch<{ profile: ProfileInfo; plan: PlanInfo; note: string }>(
    "/v1/billing/select-plan",
    session,
    { method: "POST", body: JSON.stringify({ plan }) },
  );
}

export function requestRecommendation(
  session: Session,
  payload: Record<string, unknown>,
) {
  return authedFetch<RecommendResponse>("/v1/recommend", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
