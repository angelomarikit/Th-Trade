import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getPlan, type PlanTier } from "./plans.js";

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  plan_tier: PlanTier;
  credits_balance: number;
  credits_reset_at: string | null;
  stripe_customer_id: string | null;
}

let admin: SupabaseClient | null = null;

export function isSupabaseConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    (env.SUPABASE_URL ?? "").trim() &&
      (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
  );
}

export function getSupabaseAdmin(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  if (!isSupabaseConfigured(env)) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  if (!admin) {
    admin = createClient(
      env.SUPABASE_URL!.trim(),
      env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}

export async function requireUser(
  authHeader: string | undefined,
): Promise<User> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing Authorization Bearer token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError(401, "Invalid or expired session");
  }
  return data.user;
}

export async function getOrCreateProfile(user: User): Promise<ProfileRow> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Profile read failed: ${error.message}`);
  if (data) return data as ProfileRow;

  const insert = {
    id: user.id,
    email: user.email ?? null,
    display_name:
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "trader",
    plan_tier: "free" as PlanTier,
    credits_balance: 20,
  };
  const { data: created, error: insertErr } = await sb
    .from("profiles")
    .insert(insert)
    .select("*")
    .single();
  if (insertErr) throw new Error(`Profile create failed: ${insertErr.message}`);
  return created as ProfileRow;
}

export async function assignPlan(
  userId: string,
  tier: PlanTier,
): Promise<ProfileRow> {
  const plan = getPlan(tier);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("profiles")
    .update({
      plan_tier: tier,
      credits_balance: plan.creditsPerMonth,
      credits_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw new Error(`Plan update failed: ${error.message}`);

  await sb.from("credit_ledger").insert({
    user_id: userId,
    delta: plan.creditsPerMonth,
    reason: `plan_assign_${tier}`,
    meta: { note: "Manual/dev assign — Stripe webhook will replace this" },
  });

  return data as ProfileRow;
}

export async function spendCredits(input: {
  userId: string;
  cost: number;
  reason: string;
  meta?: Record<string, unknown>;
}): Promise<ProfileRow> {
  const sb = getSupabaseAdmin();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", input.userId)
    .single();
  if (error || !profile) throw new Error("Profile not found");
  const row = profile as ProfileRow;
  if (row.credits_balance < input.cost) {
    throw new AuthError(402, `Insufficient credits (need ${input.cost}, have ${row.credits_balance})`);
  }
  const next = row.credits_balance - input.cost;
  const { data: updated, error: upErr } = await sb
    .from("profiles")
    .update({ credits_balance: next, updated_at: new Date().toISOString() })
    .eq("id", input.userId)
    .eq("credits_balance", row.credits_balance)
    .select("*")
    .single();
  if (upErr || !updated) {
    throw new AuthError(409, "Credit update conflict — retry");
  }
  await sb.from("credit_ledger").insert({
    user_id: input.userId,
    delta: -input.cost,
    reason: input.reason,
    meta: input.meta ?? {},
  });
  return updated as ProfileRow;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
