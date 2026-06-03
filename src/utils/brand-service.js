/**
 * Brand list + prefix matching for extension save flow
 */
import { getAuthHeaders } from './auth-store.js';

let brandsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Extract brand prefix from report name (e.g. IP-123, IP - 487 → IP) */
export function extractReportPrefix(reportName) {
  const match = String(reportName || '').match(/^([A-Za-z]{2,})\s*-/);
  return match ? match[1].toUpperCase() : null;
}

/** Find brand whose prefix matches report name */
export function matchBrandByPrefix(reportName, brands) {
  const prefix = extractReportPrefix(reportName);
  if (!prefix || !Array.isArray(brands)) return null;
  return brands.find((b) => b.prefix && b.prefix.toUpperCase() === prefix) || null;
}

/** Fetch brands the logged-in user can access (cached) */
export async function fetchAccessibleBrands({ forceRefresh = false } = {}) {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) return [];

  if (!forceRefresh && brandsCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return brandsCache;
  }

  const response = await fetch(`${process.env.API_URL}/brands`, { headers });
  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) return [];

  brandsCache = json.data;
  cacheTimestamp = Date.now();
  return brandsCache;
}

export function clearBrandsCache() {
  brandsCache = null;
  cacheTimestamp = 0;
}
