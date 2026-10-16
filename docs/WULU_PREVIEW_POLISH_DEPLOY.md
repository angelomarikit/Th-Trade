# Preview polish deploy verification

**Branch:** `phase7/scanner-v2-preview` only (production + PR #2 unchanged).

## Automated checks (local)

| Check | Result |
| --- | --- |
| `npm run build` (all workspaces) | Pass |
| `npm test` (vitest) | **113** tests, **34** files, pass |
| `setupChartSync.test.ts` | Symbol mismatch + stale eval hide levels |
| `watchMonitor.test.ts` | User-visible vs persisted alert filters |
| `lifecycleDemo.test.ts` | ENTRY / MISSED / INVALIDATED / target paths |

## Chart ↔ recommendation safety

- Level lines render only when `canShowSetupChartLevels`: active ticker = bars symbol = setup symbol, scan &lt; 30s old, data verified, not loading.
- Stale or mismatched ticker hides overlays and triggers debounced fast poll (15s baseline).
- Setup responses include explicit `liveCard.symbol` / `side` for alignment checks.
- Late setup responses discarded if user switched symbol mid-flight.

## Alert history

- **Persisted (internal):** `isMonitorEventPersisted` — includes safety transitions (e.g. ENTRY ACTIVE → DATA NOT VERIFIED).
- **UI / in-app feed:** `isUserVisibleAlertTransition` — meaningful lifecycle only.
- **Audit API:** `GET /v1/monitor/events?audit=1` returns full persisted history for signed-in sessions.

## Controlled lifecycle demo

```bash
node scripts/demo-lifecycle-simulation.mjs
```

Runs confirmation lifecycle vitest plus monitor alert + chart-sync unit tests.

## Wulu RTH acceptance

See `docs/WULU_RTH_MILESTONE_CHECKLIST.md`. Paper trading remains on hold until signed-in RTH recording passes.
