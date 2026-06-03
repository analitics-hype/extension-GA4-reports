/**
 * Extension build env — development vs production URLs
 * Load order: .env.{mode} → .env.local → .local.env (legacy)
 */
const path = require('path');
const dotenv = require('dotenv');

const DEFAULTS = {
  development: {
    API_URL: 'http://localhost:3000/api',
    DASHBOARD_URL: 'http://localhost:3001',
  },
  production: {
    API_URL: 'https://backend-ga4-reports-production.up.railway.app/api',
    DASHBOARD_URL: 'https://www.abtestcalculator.com.tr',
  },
};

function loadExtensionEnv(mode = 'development') {
  const root = __dirname;
  const defaults = DEFAULTS[mode] || DEFAULTS.development;

  dotenv.config({ path: path.join(root, `.env.${mode}`) });
  dotenv.config({ path: path.join(root, '.env.local') });

  const env = {
    EXTENSION_ENV: mode,
    API_URL: process.env.API_URL || defaults.API_URL,
    DASHBOARD_URL: process.env.DASHBOARD_URL || defaults.DASHBOARD_URL,
  };

  // eslint-disable-next-line no-console
  console.log(
    `[extension] ${mode} → API=${env.API_URL} | Dashboard=${env.DASHBOARD_URL}`,
  );

  return env;
}

module.exports = { loadExtensionEnv, DEFAULTS };
