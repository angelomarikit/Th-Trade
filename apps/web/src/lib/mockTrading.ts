import { readJson, writeJson } from "./storage";

export type MockOrderKind = "entry" | "exit";

export interface MockOrder {
  id: string;
  at: number;
  kind: MockOrderKind;
  symbol: string;
  side: "LONG" | "SHORT";
  shares: number;
  price: number;
  stop?: number;
  t1?: number;
  t2?: number;
  note?: string;
  positionId?: string;
}

export interface MockPosition {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  shares: number;
  entryPrice: number;
  stop: number;
  t1: number;
  t2: number;
  openedAt: number;
  lastMark?: number;
  setupAction?: string;
  practiceNote?: string;
}

export interface MockPortfolio {
  startingCash: number;
  realizedPnl: number;
  positions: MockPosition[];
  orders: MockOrder[];
}

const PORTFOLIO_KEY = "wulu.v2.mockPortfolio";
const MODE_KEY = "wulu:mock-trading";
export const DEFAULT_MOCK_SHARES = 10;
const STARTING_CASH = 100_000;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function readMockTradingMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMockTradingMode(on: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function readMockPortfolio(): MockPortfolio {
  return readJson<MockPortfolio>(PORTFOLIO_KEY, {
    startingCash: STARTING_CASH,
    realizedPnl: 0,
    positions: [],
    orders: [],
  });
}

export function writeMockPortfolio(portfolio: MockPortfolio): void {
  writeJson(PORTFOLIO_KEY, portfolio);
}

export function resetMockPortfolio(): MockPortfolio {
  const fresh: MockPortfolio = {
    startingCash: STARTING_CASH,
    realizedPnl: 0,
    positions: [],
    orders: [],
  };
  writeMockPortfolio(fresh);
  return fresh;
}

export function unrealizedPnl(position: MockPosition, mark: number): number {
  if (!Number.isFinite(mark)) return 0;
  const diff = position.side === "LONG" ? mark - position.entryPrice : position.entryPrice - mark;
  return diff * position.shares;
}

export function openMockPosition(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  shares: number;
  entryPrice: number;
  stop: number;
  t1: number;
  t2: number;
  setupAction?: string;
  practiceNote?: string;
}): { portfolio: MockPortfolio; error?: string } {
  let portfolio = readMockPortfolio();
  const sym = input.symbol.trim().toUpperCase();
  const open = portfolio.positions.find(
    (p) => p.symbol === sym && p.side === input.side,
  );
  if (open) {
    return { portfolio, error: `Already have a practice ${input.side} on ${sym}. Close it first.` };
  }
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    return { portfolio, error: "Need a valid price to simulate entry." };
  }
  const position: MockPosition = {
    id: newId(),
    symbol: sym,
    side: input.side,
    shares: Math.max(1, Math.floor(input.shares)),
    entryPrice: input.entryPrice,
    stop: input.stop,
    t1: input.t1,
    t2: input.t2,
    openedAt: Date.now(),
    lastMark: input.entryPrice,
    setupAction: input.setupAction,
    practiceNote: input.practiceNote,
  };
  const order: MockOrder = {
    id: newId(),
    at: position.openedAt,
    kind: "entry",
    symbol: sym,
    side: input.side,
    shares: position.shares,
    price: position.entryPrice,
    stop: position.stop,
    t1: position.t1,
    t2: position.t2,
    note: input.practiceNote ?? "Practice entry (local paper only)",
    positionId: position.id,
  };
  portfolio = {
    ...portfolio,
    positions: [position, ...portfolio.positions],
    orders: [order, ...portfolio.orders].slice(0, 200),
  };
  writeMockPortfolio(portfolio);
  return { portfolio };
}

export function closeMockPosition(input: {
  positionId: string;
  exitPrice: number;
  reason?: string;
}): { portfolio: MockPortfolio; error?: string; pnl?: number } {
  let portfolio = readMockPortfolio();
  const idx = portfolio.positions.findIndex((p) => p.id === input.positionId);
  if (idx < 0) return { portfolio, error: "Position not found." };
  const position = portfolio.positions[idx]!;
  const mark = input.exitPrice;
  if (!Number.isFinite(mark) || mark <= 0) {
    return { portfolio, error: "Need a valid exit price." };
  }
  const pnl = unrealizedPnl(position, mark);
  const order: MockOrder = {
    id: newId(),
    at: Date.now(),
    kind: "exit",
    symbol: position.symbol,
    side: position.side,
    shares: position.shares,
    price: mark,
    note: input.reason ?? "Practice exit",
    positionId: position.id,
  };
  portfolio = {
    ...portfolio,
    realizedPnl: portfolio.realizedPnl + pnl,
    positions: portfolio.positions.filter((p) => p.id !== position.id),
    orders: [order, ...portfolio.orders].slice(0, 200),
  };
  writeMockPortfolio(portfolio);
  return { portfolio, pnl };
}

export function updateMockMarks(symbol: string, mark: number): MockPortfolio {
  if (!Number.isFinite(mark)) return readMockPortfolio();
  const sym = symbol.trim().toUpperCase();
  const portfolio = readMockPortfolio();
  let changed = false;
  const positions = portfolio.positions.map((p) => {
    if (p.symbol !== sym) return p;
    if (p.lastMark === mark) return p;
    changed = true;
    return { ...p, lastMark: mark };
  });
  if (!changed) return portfolio;
  const next = { ...portfolio, positions };
  writeMockPortfolio(next);
  return next;
}
