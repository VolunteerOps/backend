import { app } from '../src/app.js';
import http from 'http';

async function runTests() {
  console.log('🧪 Starting Dual-Token Flow & Background Refresh Verification Suite...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));

  const BASE_URL = 'http://localhost:3099/api/auth';

  try {
    // 1. Test Login
    console.log('1️⃣ Testing Login (/api/auth/login)...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@volunteerops.org',
        password: 'AdminPass@2026!',
      }),
    });

    const loginData = await loginRes.json();
    const setCookieHeaders = loginRes.headers.get('set-cookie') || '';

    const accessToken = loginData.access_token || loginData.accessToken;
    const refreshToken = loginData.refresh_token || loginData.refreshToken;

    if (!accessToken || !refreshToken) {
      throw new Error(`Login failed to return dual tokens: ${JSON.stringify(loginData)}`);
    }

    console.log('  ✅ Received Access Token:', accessToken.slice(0, 25) + '...');
    console.log('  ✅ Received Refresh Token:', refreshToken.slice(0, 25) + '...');
    console.log('  ✅ Cookie Header present:', setCookieHeaders.includes('vops_access_token') && setCookieHeaders.includes('vops_refresh_token'));

    const initialAccessToken = accessToken;
    const initialRefreshToken = refreshToken;

    // 2. Test Protected Route with Access Token
    console.log('\n2️⃣ Testing Protected Route (/api/auth/me) with Access Token...');
    const meRes = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${initialAccessToken}` },
    });
    const meData: any = await meRes.json();
    if (meRes.status !== 200 || !meData.user) {
      throw new Error(`Failed to access /me: ${JSON.stringify(meData)}`);
    }
    console.log(`  ✅ Profile retrieved: ${meData.user.full_name || meData.user.fullName} (${meData.user.role})`);

    // 3. Test Silent Background Refresh
    console.log('\n3️⃣ Testing Silent Background Refresh (/api/auth/refresh)...');
    const refreshRes = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: initialRefreshToken }),
    });

    const refreshData: any = await refreshRes.json();
    const rotatedAccessToken = refreshData.access_token || refreshData.accessToken;
    const rotatedRefreshToken = refreshData.refresh_token || refreshData.refreshToken;

    if (refreshRes.status !== 200 || !rotatedAccessToken || !rotatedRefreshToken) {
      throw new Error(`Refresh failed: ${JSON.stringify(refreshData)}`);
    }

    console.log('  ✅ Token Rotated Successfully!');
    console.log('  ✅ New Access Token:', rotatedAccessToken.slice(0, 25) + '...');
    console.log('  ✅ New Refresh Token:', rotatedRefreshToken.slice(0, 25) + '...');

    // 4. Test accessing route with the rotated access token
    console.log('\n4️⃣ Testing Protected Route with Rotated Access Token...');
    const meRotatedRes = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${rotatedAccessToken}` },
    });
    if (meRotatedRes.status !== 200) {
      throw new Error('Failed to query with rotated access token');
    }
    console.log('  ✅ Successfully authenticated with rotated access token!');

    // 5. Test Replay Attack Detection (Re-using old initialRefreshToken)
    console.log('\n5️⃣ Testing Replay Attack Detection (Reusing old rotated refresh token)...');
    const replayRes = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: initialRefreshToken }),
    });

    const replayData: any = await replayRes.json();
    if (
      replayRes.status === 401 &&
      (replayData.error === 'TOKEN_REUSE_DETECTED' ||
        replayData.code === 'TOKEN_REUSE_DETECTED' ||
        replayData.error?.code === 'TOKEN_REUSE_DETECTED')
    ) {
      console.log('  🛡️ REPLAY DETECTED & PREVENTED: Old token was rejected with TOKEN_REUSE_DETECTED!');
    } else {
      throw new Error(`Expected TOKEN_REUSE_DETECTED, got: ${JSON.stringify(replayData)}`);
    }

    // 6. Test Logout
    console.log('\n6️⃣ Testing Logout (/api/auth/logout)...');
    const logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
    });
    const logoutData = await logoutRes.json();
    console.log('  ✅ Logout response:', logoutData);

    console.log('\n🎉 ALL DUAL-TOKEN & BACKGROUND REFRESH TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Test step failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
