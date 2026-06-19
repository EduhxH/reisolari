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
        className="supaste-glass-strong w-full rounded-full px-4 py-3 text-sm font-medium text-supaste-black outline-none placeholder:text-supaste-muted/80 focus:border-supaste-blue"
      />
      {open && suggestions.length > 0 ? (
        <ul className="supaste-glass-strong absolute z-10 mt-2 w-full overflow-hidden rounded-[22px] p-1">
          {suggestions.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="block w-full rounded-[18px] px-3 py-2 text-left text-sm font-medium text-supaste-black transition-colors duration-300 hover:bg-[#f5f5f7]"
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
