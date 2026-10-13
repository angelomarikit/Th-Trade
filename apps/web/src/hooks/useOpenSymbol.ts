import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTerminal } from "../context/TerminalContext";

/**
 * Platform-wide: search, opportunity row, or watchlist → Scanner chart + analysis.
 */
export function useOpenSymbol() {
  const navigate = useNavigate();
  const { selectSymbol, setSide, scan } = useTerminal();

  return useCallback(
    (symbol: string, opts?: { side?: "LONG" | "SHORT"; brief?: boolean }) => {
      const s = symbol.trim().toUpperCase();
      if (!s) return;
      if (opts?.side) setSide(opts.side);
      navigate("/scanner");
      if (opts?.side) {
        void scan({ ticker: s, side: opts.side, brief: opts.brief === true });
      } else {
        selectSymbol(s, { brief: opts?.brief === true });
      }
    },
    [navigate, scan, selectSymbol, setSide],
  );
}
