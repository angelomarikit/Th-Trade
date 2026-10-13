import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { searchSymbolsApi, type SymbolSearchHit } from "../../lib/api";

export function SymbolSearch(props: {
  initial?: string;
  onSelect: (symbol: string) => void;
  size?: "top" | "hero";
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [q, setQ] = useState(props.initial ?? "");
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  /** True only after the user edits the field — blocks passive dropdown on symbol sync. */
  const userQueryRef = useRef(false);

  useEffect(() => {
    userQueryRef.current = false;
    setQ(props.initial ?? "");
    setHits([]);
    setOpen(false);
    setActive(0);
  }, [props.initial]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!userQueryRef.current) {
      setHits([]);
      setOpen(false);
      setBusy(false);
      return;
    }
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      setBusy(true);
      void searchSymbolsApi(query)
        .then((r) => {
          if (!userQueryRef.current) return;
          setHits(r.results);
          setActive(0);
          setOpen(r.results.length > 0);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 120);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q]);

  function commit(symbol: string) {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    userQueryRef.current = false;
    setQ(s);
    setOpen(false);
    setHits([]);
    props.onSelect(s);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const pick = open && hits[active]?.symbol ? hits[active].symbol : q;
    commit(pick);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const size = props.size ?? "top";

  return (
    <div className={`symbol-search symbol-search-${size}`} ref={wrapRef}>
      <form className="symbol-search-form" onSubmit={onSubmit} role="search">
        <Search size={size === "hero" ? 18 : 16} aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => {
            userQueryRef.current = true;
            setQ(e.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder ?? "Search ticker or company name…"}
          aria-label="Stock search"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          spellCheck={false}
          autoFocus={props.autoFocus}
        />
        <button type="submit" className="symbol-search-btn">
          Search
        </button>
      </form>
      {open && hits.length > 0 && (
        <ul id={listId} className="symbol-search-results" role="listbox">
          {hits.map((h, i) => (
            <li key={h.symbol} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={i === active ? "active" : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(h.symbol)}
              >
                <strong>{h.symbol}</strong>
                <span>{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy && userQueryRef.current && open && hits.length === 0 ? (
        <div className="symbol-search-hint">Searching…</div>
      ) : null}
    </div>
  );
}
