/**
 * Fetch live tests that need a GA4 snapshot refresh
 */
import { getAuthHeaders } from './auth-store.js';

export async function fetchSnapshotReminders() {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) return [];

  try {
    const response = await fetch(`${process.env.API_URL}/reports/lifecycle/reminders`, {
      headers,
    });
    const json = await response.json();
    if (!json.success) return [];
    return json.data?.snapshotDue || [];
  } catch (err) {
    console.warn('Lifecycle reminders fetch failed:', err);
    return [];
  }
}
