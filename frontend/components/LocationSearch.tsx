"use client";

import React, { useEffect, useRef, useState } from "react";

type Suggestion = { id: string; place_name: string; center: [number, number] };

type Props = {
  onSelect: (lon: number, lat: number, label: string) => void;
  placeholder?: string;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

/**
 * Address/locality search bar over the Mapbox Geocoding API (Portugal). Lets the
 * user jump the map straight to where they live instead of zooming manually.
 */
const LocationSearch: React.FC<Props> = ({ onSelect, placeholder }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = query.trim();
    if (!TOKEN || text.length < 3) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
          `?access_token=${TOKEN}&country=pt&language=pt&autocomplete=true&limit=5` +
          `&types=address,place,locality,neighborhood,postcode`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const items: Suggestion[] = (data.features ?? []).map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center
        }));
        setSuggestions(items);
        setOpen(true);
      } catch {
        // ignore network errors — search simply yields no suggestions
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const pick = (s: Suggestion) => {
    setQuery(s.place_name);
    setOpen(false);
    setSuggestions([]);
    onSelect(s.center[0], s.center[1], s.place_name);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder ?? "Procurar morada ou localidade…"}
        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600"
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                {s.place_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default LocationSearch;
