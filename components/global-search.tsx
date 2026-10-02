"use client";
import { useEffect, useRef, useState } from "react";

export type SearchResult = { id: number; type: "product" | "order" | "customer"; title: string; detail: string };
const labels = { product: "صنف", order: "طلب", customer: "عميل" };

export default function GlobalSearch({ openResult }: { openResult: (result: SearchResult) => void }) {
  const [query, setQuery] = useState(""), [results, setResults] = useState<SearchResult[]>([]), [loading, setLoading] = useState(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
      const data = await response.json();
      setResults(response.ok && Array.isArray(data) ? data : []);
      setLoading(false);
    }, 250);
  }
  return <div className="global-search">
    <label className="search">⌕ <input value={query} onChange={(event) => search(event.target.value)} placeholder="ابحث عن صنف أو طلب أو عميل..." /></label>
    {query.trim().length >= 2 && <div className="global-search-results">
      {loading ? <div>جاري البحث...</div> : results.length ? results.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => { openResult(result); setQuery(""); setResults([]); }}><i>{labels[result.type]}</i><span><b>{result.title}</b><small>{result.detail}</small></span><em>فتح ←</em></button>) : <div>لا توجد نتائج مطابقة.</div>}
    </div>}
  </div>;
}
