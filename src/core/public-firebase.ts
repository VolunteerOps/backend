/** Public SDK configuration only. App selection never confers a database role. */
export function publicFirebaseConfiguration(env: NodeJS.ProcessEnv = process.env, app: 'volunteer' | 'ops' = 'volunteer') {
  const prefix = app === 'ops' ? 'FIREBASE_OPS_WEB_' : 'FIREBASE_WEB_';
  const apiKey = env[prefix + 'API_KEY']?.trim();
  const authDomain = env[prefix + 'AUTH_DOMAIN']?.trim();
  const appId = env[prefix + 'APP_ID']?.trim();
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!apiKey || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey) || !authDomain ||
      !/^[a-zA-Z0-9.-]+$/.test(authDomain) || !appId || !projectId) return null;
  return { apiKey, authDomain, projectId, appId };
}
