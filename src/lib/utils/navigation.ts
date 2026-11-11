export interface NavMatchCandidate {
  href: string;
  exact?: boolean;
}

function normalizeNavPath(path: string): string {
  if (!path) return '/';
  const [clean] = path.split(/[?#]/);
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean || '/';
}

/**
 * Resolve the single most-specific matching navigation href for the current pathname.
 * Ensures parent routes (e.g. `/admin/reports`) do not remain active when a
 * more-specific sibling route (e.g. `/admin/reports/monthly`) is open.
 */
export function resolveActiveNavHref(
  pathname: string,
  items: readonly NavMatchCandidate[]
): string | null {
  const currentPath = normalizeNavPath(pathname);
  let bestHref: string | null = null;
  let bestLength = -1;

  for (const item of items) {
    if (!item.href || item.href === '#') continue;

    const candidatePath = normalizeNavPath(item.href);
    const matches = item.exact
      ? currentPath === candidatePath
      : candidatePath === '/'
        ? currentPath === '/'
        : currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`);

    if (matches && candidatePath.length > bestLength) {
      bestHref = item.href;
      bestLength = candidatePath.length;
    }
  }

  return bestHref;
}

