import { createElement, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { pageLoader } from '../pageRegistry';
import { WIKI_PAGES, type WikiPageInfo } from '../tree';

export interface SearchEntry {
  pageId: string;
  pageTitle: string;
  anchor: string;
  heading: string;
  text: string;
}

export interface SearchResult {
  entry: SearchEntry;
  snippet: string;
}

const MAX_RESULTS = 12;
const SNIPPET_LENGTH = 110;
const BLOCK_SELECTOR = 'td, th, li, p, h3';

function squash(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function entriesOf(page: WikiPageInfo, Body: ComponentType): SearchEntry[] {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() =>
    root.render(createElement(MemoryRouter, null, createElement(Body))),
  );
  host.querySelectorAll('[data-skip-search]').forEach((el) => el.remove());
  host.querySelectorAll(BLOCK_SELECTOR).forEach((el) => el.append(' '));
  const sections = [...host.querySelectorAll('section[id]')];
  const entries = sections.map((section) => ({
    pageId: page.id,
    pageTitle: page.title,
    anchor: section.id,
    heading: squash(section.querySelector('h3')?.textContent ?? ''),
    text: squash(section.textContent),
  }));
  sections.forEach((section) => section.remove());
  const intro = squash(host.textContent);
  root.unmount();
  return [
    {
      pageId: page.id,
      pageTitle: page.title,
      anchor: '',
      heading: '',
      text: squash(`${page.summary} ${intro}`),
    },
    ...entries,
  ];
}

let indexPromise: Promise<SearchEntry[]> | null = null;

export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = Promise.all(
      WIKI_PAGES.map((page) =>
        pageLoader(page)().then((module) => entriesOf(page, module.default)),
      ),
    )
      .then((lists) => lists.flat())
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

function snippetOf(text: string, term: string): string {
  const at = Math.max(0, text.toLowerCase().indexOf(term));
  const start = Math.max(0, at - 30);
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

function scoreOf(entry: SearchEntry, terms: string[]): number {
  const title = entry.pageTitle.toLowerCase();
  const heading = entry.heading.toLowerCase();
  const text = entry.text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const occurrences = text.split(term).length - 1;
    const inTitle = entry.anchor === '' && title.includes(term);
    if (occurrences === 0 && !inTitle) return 0;
    score +=
      Math.min(occurrences, 5) +
      (inTitle ? 8 : 0) +
      (heading.includes(term) ? 4 : 0);
  }
  return score;
}

export function search(entries: SearchEntry[], query: string): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return entries
    .map((entry) => ({ entry, score: scoreOf(entry, terms) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ entry }) => ({ entry, snippet: snippetOf(entry.text, terms[0]) }));
}
