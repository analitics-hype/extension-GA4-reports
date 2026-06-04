/**
 * Mini login prompt before analysis results when user is not logged in
 */
import { getStoredToken, loginToApi } from '../../utils/auth-store.js';

const PROMPT_ID = 'ga4-auth-prompt-overlay';

/** Remove prompt if still mounted */
function removePrompt() {
  document.getElementById(PROMPT_ID)?.remove();
}

/**
 * Show login mini-popup; resolves login | skip | cancel
 * @returns {Promise<'login'|'skip'|'cancel'>}
 */
export function showAuthLoginPrompt() {
  return new Promise((resolve) => {
    removePrompt();

    const overlay = document.createElement('div');
    overlay.id = PROMPT_ID;
    overlay.className = 'ga4-auth-prompt-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ga4-auth-prompt-title');

    overlay.innerHTML = `
      <div class="ga4-auth-prompt-card">
        <button type="button" class="ga4-auth-prompt-close" aria-label="Kapat">&times;</button>
        <h3 id="ga4-auth-prompt-title" class="ga4-auth-prompt-title">Dashboard'a kaydetmek için giriş yapın</h3>
        <p class="ga4-auth-prompt-desc">
          Giriş yaparsanız analiz sonucu otomatik kaydedilir; AI yorumu ve marka eşlemesi kullanılabilir.
        </p>
        <div class="ga4-auth-prompt-warning">
          Giriş yapmadan devam ederseniz rapor <strong>kaydedilmez</strong> ve dashboard'da görünmez.
        </div>
        <div class="ga4-auth-prompt-form">
          <input type="text" id="ga4AuthUsername" class="ga4-auth-prompt-input" placeholder="Kullanıcı adı" autocomplete="username">
          <input type="password" id="ga4AuthPassword" class="ga4-auth-prompt-input" placeholder="Şifre" autocomplete="current-password">
          <div class="ga4-auth-prompt-error" id="ga4AuthError" style="display:none;"></div>
          <button type="button" class="ga4-auth-prompt-btn ga4-auth-prompt-btn-primary" id="ga4AuthLoginBtn">Giriş Yap</button>
        </div>
        <button type="button" class="ga4-auth-prompt-btn ga4-auth-prompt-btn-ghost" id="ga4AuthSkipBtn">
          Giriş yapmadan devam et
        </button>
      </div>
    `;

    const finish = (choice) => {
      removePrompt();
      document.removeEventListener('keydown', onKeyDown);
      resolve(choice);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') finish('cancel');
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });

    overlay.querySelector('.ga4-auth-prompt-close')?.addEventListener('click', () => finish('cancel'));
    overlay.querySelector('#ga4AuthSkipBtn')?.addEventListener('click', () => finish('skip'));

    const loginBtn = overlay.querySelector('#ga4AuthLoginBtn');
    const usernameInput = overlay.querySelector('#ga4AuthUsername');
    const passwordInput = overlay.querySelector('#ga4AuthPassword');
    const errorEl = overlay.querySelector('#ga4AuthError');

    const showError = (msg) => {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    };

    const runLogin = async () => {
      const username = usernameInput?.value?.trim();
      const password = passwordInput?.value;

      if (!username || !password) {
        showError('Kullanıcı adı ve şifre gerekli');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = 'Giriş yapılıyor…';

      try {
        await loginToApi(username, password);
        finish('login');
      } catch (err) {
        showError(err.message || 'Giriş başarısız');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Giriş Yap';
      }
    };

    loginBtn?.addEventListener('click', runLogin);
    passwordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runLogin();
    });
    usernameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') passwordInput?.focus();
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);
    usernameInput?.focus();
  });
}

/**
 * Block analysis results until login or explicit skip
 * @returns {Promise<{ cancelled: boolean, allowSave: boolean, freshLogin: boolean }>}
 */
export async function gateAnalysisAuth() {
  if (await getStoredToken()) {
    return { cancelled: false, allowSave: true, freshLogin: false };
  }

  const choice = await showAuthLoginPrompt();

  if (choice === 'cancel') {
    return { cancelled: true, allowSave: false, freshLogin: false };
  }

  if (choice === 'login') {
    return { cancelled: false, allowSave: true, freshLogin: true };
  }

  return { cancelled: false, allowSave: false, freshLogin: false };
}
