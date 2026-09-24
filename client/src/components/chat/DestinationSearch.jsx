import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';

export default function DestinationSearch({ api, token, onSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setError('');
      setLoading(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError('');
      try {
        const data = await api(`/search?q=${encodeURIComponent(trimmedQuery)}`, { token });
        if (currentRequest === requestId.current) setSuggestions(data.suggestions || []);
      } catch (requestError) {
        if (currentRequest === requestId.current) {
          setSuggestions([]);
          setError(requestError.message || 'Place search is temporarily unavailable.');
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [query, api, token]);

  const clear = () => {
    requestId.current += 1;
    setQuery('');
    setSuggestions([]);
    setError('');
  };

  const select = (suggestion) => {
    setQuery(suggestion.name || suggestion.address);
    setSuggestions([]);
    onSelect?.(suggestion);
  };

  const showDropdown = query.trim().length >= 2;
  return <div className="absolute left-3 right-3 top-3 z-[600] sm:left-5 sm:right-auto sm:top-5 sm:w-[min(26rem,calc(100%-2.5rem))]">
    <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 shadow-lg shadow-slate-900/10 backdrop-blur-md">
      <Search size={19} className="shrink-0 text-slate-500" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" placeholder="Where to?" aria-label="Search for a destination" />
      {loading && <LoaderCircle size={18} className="shrink-0 animate-spin text-teal-600" />}
      {query && <button type="button" onClick={clear} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Clear destination search"><X size={18} /></button>}
    </div>
    {showDropdown && <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/15 backdrop-blur-md">
      {error ? <p className="p-4 text-sm text-amber-800">{error}</p> : loading ? <p className="p-4 text-sm text-slate-500">Searching places in Pakistan…</p> : suggestions.length === 0 ? <p className="p-4 text-sm text-slate-500">No places found in Pakistan. Try a more specific name.</p> : <div className="max-h-28 overflow-y-auto py-1 sm:max-h-64">{suggestions.map((suggestion) => <button key={suggestion.id || `${suggestion.lat}-${suggestion.lng}`} type="button" onClick={() => select(suggestion)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"><MapPin size={18} className="mt-0.5 shrink-0 text-teal-600" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{suggestion.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{suggestion.address}</span></span></button>)}</div>}
    </div>}
  </div>;
}
