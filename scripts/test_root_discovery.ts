import { app } from '../src/app.js';
import http from 'http';

async function testRootAndUsers() {
  console.log('🧪 Testing Root Discovery & Users Module Endpoints...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3098, resolve));

  const BASE_URL = 'http://localhost:3098';

  try {
    // 1. Test GET /
    console.log('1️⃣ Testing GET / (Base Discovery)...');
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootData: any = await rootRes.json();
    console.log('  Status:', rootRes.status);
    console.log('  Response message:', rootData.message);
    console.log('  Endpoints count:', Object.keys(rootData.endpoints).length);
    console.log('  Endpoints sample:', Object.keys(rootData.endpoints));

    if (rootRes.status !== 200 || rootData.message !== 'VolunteerOps Backend API' || !rootData.endpoints.users) {
      throw new Error(`GET / failed: ${JSON.stringify(rootData)}`);
    }
    console.log('  ✅ GET / Discovery Passed!');

    // 2. Test GET /api
    console.log('\n2️⃣ Testing GET /api...');
    const apiRes = await fetch(`${BASE_URL}/api`);
    const apiData: any = await apiRes.json();
    if (apiRes.status !== 200 || apiData.message !== 'VolunteerOps Backend API') {
      throw new Error(`GET /api failed: ${JSON.stringify(apiData)}`);
    }
    console.log('  ✅ GET /api Discovery Passed!');

    // 3. Login as Admin
    console.log('\n3️⃣ Authenticating as Admin for Users API test...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@volunteerops.org',
        password: 'AdminPass@2026!',
      }),
    });
    const loginData: any = await loginRes.json();
    const token = loginData.access_token || loginData.accessToken;

    // 4. Test GET /api/users
    console.log('\n4️⃣ Testing GET /api/users...');
    const usersRes = await fetch(`${BASE_URL}/api/users?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const usersData: any = await usersRes.json();
    console.log('  Status:', usersRes.status);
    console.log('  Total users found:', usersData.pagination?.total);
    console.log('  Users returned:', usersData.data?.length);

    if (usersRes.status !== 200 || !usersData.data) {
      throw new Error(`GET /api/users failed: ${JSON.stringify(usersData)}`);
    }
    console.log('  ✅ GET /api/users Passed!');

    // 5. Test GET /api/users/:id
    console.log('\n5️⃣ Testing GET /api/users/1...');
    const userDetailRes = await fetch(`${BASE_URL}/api/users/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userDetailData: any = await userDetailRes.json();
    console.log('  User detail name:', userDetailData.data?.fullName || userDetailData.data?.full_name);
    if (userDetailRes.status !== 200) {
      throw new Error(`GET /api/users/1 failed: ${JSON.stringify(userDetailData)}`);
    }
    console.log('  ✅ GET /api/users/1 Passed!');

    console.log('\n🎉 ALL BASE DISCOVERY & USERS API TESTS PASSED!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

testRootAndUsers();
