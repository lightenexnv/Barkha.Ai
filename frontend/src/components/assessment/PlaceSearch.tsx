import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { searchPlaces, type SearchResult } from "@/lib/climate";

/** Place search with a debounced suggestion list (OpenStreetMap Nominatim). */
export const PlaceSearch = ({ onSelect }: { onSelect: (result: SearchResult) => void }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    // Nominatim allows about one request a second
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchPlaces(q, controller.signal);
        setResults(found);
        setError(found.length ? null : t("location.noResults"));
        setActive(found.length ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setError(err instanceof Error ? err.message : t("location.searchFailed"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 650);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, t]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (result: SearchResult) => {
    onSelect(result);
    setQuery(result.label.split(",").slice(0, 2).join(","));
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || !results.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            choose(results[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={t("location.searchPlaceholder")}
        aria-label={t("location.searchPlaceholder")}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="place-search-results"
        className="h-11 pe-9 ps-9"
      />
      {loading ? (
        <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
      ) : (
        query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={t("location.clearSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        )
      )}

      {open && (results.length > 0 || error) && query.trim().length >= 3 && (
        <ul
          id="place-search-results"
          role="listbox"
          className="absolute z-[1100] mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
        >
          {error && !results.length ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{error}</li>
          ) : (
            results.map((result, index) => (
              <li key={`${result.latitude},${result.longitude},${index}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(result)}
                  className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-start text-sm ${
                    index === active ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="line-clamp-2">{result.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
