/** Maximum risk per trade as fraction of verified account value. */
export const MAX_RISK_FRACTION = 0.02;

export const POSITION_SIZE_NOT_CALCULATED_MESSAGE =
  "POSITION SIZE NOT CALCULATED — CURRENT ACCOUNT VALUE REQUIRED.";

export interface PositionSizeResult {
  calculated: boolean;
  shares: number | null;
  dollarsAtRisk: number | null;
  message: string | null;
}

/**
 * Size by stop distance using verified account value only.
 * Never use Alpaca paper balance.
 */
export function calculatePositionSize(input: {
  verifiedAccountValue: number | null | undefined;
  entryPrice: number;
  stopPrice: number;
  riskFraction?: number;
}): PositionSizeResult {
  const riskFraction = input.riskFraction ?? MAX_RISK_FRACTION;
  const account = input.verifiedAccountValue;

  if (account == null || !Number.isFinite(account) || account <= 0) {
    return {
      calculated: false,
      shares: null,
      dollarsAtRisk: null,
      message: POSITION_SIZE_NOT_CALCULATED_MESSAGE,
    };
  }

  const stopDistance = Math.abs(input.entryPrice - input.stopPrice);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return {
      calculated: false,
      shares: null,
      dollarsAtRisk: null,
      message: POSITION_SIZE_NOT_CALCULATED_MESSAGE,
    };
  }

  const dollarsAtRisk = account * riskFraction;
  const shares = Math.floor(dollarsAtRisk / stopDistance);

  return {
    calculated: shares > 0,
    shares: shares > 0 ? shares : 0,
    dollarsAtRisk,
    message: shares > 0 ? null : "POSITION SIZE ZERO — STOP DISTANCE TOO WIDE FOR RISK BUDGET.",
  };
}
