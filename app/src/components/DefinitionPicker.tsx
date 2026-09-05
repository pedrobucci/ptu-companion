import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ContentKindSlug, SearchHit } from "../lib/api";
import { IconSearch } from "./icons";

/** Search-by-name combobox that replaces raw `definition_version_id` text
 * entry (restart plan §2 blocker: "internal-ID collection entry"). Type a
 * human name, arrow/click a match, done — the caller never sees or types
 * an id. A minimal ARIA combobox: input + listbox, arrow-key navigation,
 * Enter to select, Escape to close. */
export function DefinitionPicker({
  kind,
  onSelect,
  placeholder,
  label,
}: {
  kind: ContentKindSlug;
  onSelect: (hit: SearchHit) => void | Promise<unknown>;
  placeholder?: string;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const searchQuery = useQuery({
    queryKey: ["picker-search", kind, query],
    queryFn: () => api.searchContent(query.trim(), kind, 8, 0),
    enabled: query.trim().length > 0,
  });
  const results = searchQuery.data ?? [];

  const select = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    onSelect(hit);
  };

  return (
    <div className="definition-picker">
      <label htmlFor={listId + "-input"} className="visually-hidden-label">
        {label}
      </label>
      <span className="input-with-icon">
        <IconSearch className="input-icon" />
        <input
          id={listId + "-input"}
          ref={inputRef}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder ?? `Search ${label.toLowerCase()} by name…`}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              select(results[activeIndex] ?? results[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </span>
      {open && query.trim().length > 0 && (
        <ul id={listId} role="listbox" aria-label={label} className="definition-picker-results">
          {searchQuery.isLoading && <li className="definition-picker-status">Searching…</li>}
          {searchQuery.isSuccess && results.length === 0 && (
            <li className="definition-picker-status">No matches for "{query}".</li>
          )}
          {results.map((hit, i) => (
            <li
              key={hit.definition_version_id}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? "active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                select(hit);
              }}
            >
              <span>{hit.name}</span>
              <span className="definition-picker-pack">{hit.content_pack_id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
