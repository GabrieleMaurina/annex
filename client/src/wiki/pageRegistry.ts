import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { WIKI_PAGES, type WikiPageInfo } from './tree';

export const PAGE_LOADERS = import.meta.glob<{ default: ComponentType }>(
  './pages/**/*.tsx',
);

function pascalCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
}

export function pageLoader(page: WikiPageInfo) {
  return PAGE_LOADERS[`./pages/${page.section}/${pascalCase(page.slug)}.tsx`];
}

export const PAGE_COMPONENTS: Record<
  string,
  LazyExoticComponent<ComponentType>
> = Object.fromEntries(
  WIKI_PAGES.map((page) => [page.id, lazy(pageLoader(page))]),
);
