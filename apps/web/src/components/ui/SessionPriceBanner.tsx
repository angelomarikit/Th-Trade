/** Explains premarket vs RTH reference vs verified signals when chart and permission diverge. */
export function SessionPriceBanner({
  session,
  dataFresh,
  referencePriceOnly,
  reason,
}: {
  session: string | null | undefined;
  dataFresh: boolean;
  referencePriceOnly?: boolean;
  /** Exact failing check from the engine (dataFreshReason) — shown verbatim. */
  reason?: string | null;
}) {
  const sess = (session ?? "closed").toUpperCase();
  const isPremarket = sess.includes("PRE") || sess === "PREMARKET";
  const isAfter = sess.includes("AFTER") || sess === "AFTERHOURS";

  if (isPremarket) {
    return (
      <p className="banner info session-price-banner" role="status">
        Premarket: the chart may show extended-hours candles moving. The recommendation stays{" "}
        <strong>not verified</strong> until regular-session quotes and confirmations pass — premarket
        prices are context only, not entry permission.
      </p>
    );
  }

  if (isAfter) {
    return (
      <p className="banner info session-price-banner" role="status">
        After hours: candle movement is extended session. Live entry rules apply during regular hours
        unless data is explicitly verified for your plan feed.
      </p>
    );
  }

  if (dataFresh) return null;

  if (referencePriceOnly || sess === "RTH") {
    return (
      <p className="banner warn session-price-banner" role="status">
        Chart uses Alpaca bar closes. Recommendation shows{" "}
        <strong>{referencePriceOnly ? "RTH reference price" : "DATA NOT VERIFIED"}</strong> when the
        live quote is stale, wide, or fails confirmation — do not treat candle movement alone as ENTER.
        {reason ? (
          <>
            <br />
            <strong>Blocking check:</strong> {reason}
          </>
        ) : null}
      </p>
    );
  }

  return null;
}
