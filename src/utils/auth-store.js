/**
 * Extension API auth — token stored in chrome.storage.sync
 */

export function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiToken'], (result) => {
      resolve(result.apiToken || null);
    });
  });
}

export function getStoredUsername() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUsername'], (result) => {
      resolve(result.apiUsername || null);
    });
  });
}

export async function getAuthHeaders() {
  const token = await getStoredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function loginToApi(username, password) {
  const apiUrl = process.env.API_URL;
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (data.success && data.token) {
    await new Promise((resolve) => {
      chrome.storage.sync.set(
        { apiToken: data.token, apiUsername: username },
        resolve
      );
    });
    return data;
  }

  throw new Error(data.message || data.error || 'Giriş başarısız');
}

export function logoutFromApi() {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(['apiToken', 'apiUsername'], resolve);
  });
}

export function isLoggedIn() {
  return getStoredToken().then(Boolean);
}
