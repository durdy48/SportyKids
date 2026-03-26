'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { t, TEAMS } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

const SUGGESTED_SEARCHES = [...TEAMS.slice(0, 4), 'Champions League', 'NBA'];

interface SearchBarProps {
  onSearch: (query: string) => void;
  locale: Locale;
}

export function SearchBar({ onSearch, locale }: SearchBarProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(query);
      }, 300);
    },
    [onSearch],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue.trim());
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    onSearch(suggestion);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const showSuggestions = isFocused && value.trim() === '';

  return (
    <div className="relative">
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--color-muted)] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow click on suggestions
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder={t('search.placeholder', locale)}
          className="w-full pl-10 pr-10 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full shadow-sm text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent transition-shadow"
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label={t('search.clear', locale)}
          >
            <svg
              className="w-4.5 h-4.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Suggested searches dropdown */}
      {showSuggestions && (
        <div className="absolute z-10 mt-2 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-3">
          <p className="text-xs font-medium text-[var(--color-muted)] mb-2 px-1">
            {t('search.suggested', locale)}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SEARCHES.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 bg-[var(--color-background)] hover:bg-[var(--color-blue)] hover:text-white text-sm text-[var(--color-muted)] rounded-full border border-[var(--color-border)] hover:border-transparent transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
