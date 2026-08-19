import { prisma } from '../src/core/prisma.js';

async function test() {
  console.log('🚀 Testing Prisma Accelerate connection and caching...');
  
  const startTime = Date.now();
  const users = await prisma.user.findMany({
    take: 5,
    cacheStrategy: { ttl: 60, swr: 30 },
  });
  const firstDuration = Date.now() - startTime;
  console.log(`✅ First query (Cache Miss / Fill): Retrieved ${users.length} users in ${firstDuration}ms`);

  const secondStart = Date.now();
  const cachedUsers = await prisma.user.findMany({
    take: 5,
    cacheStrategy: { ttl: 60, swr: 30 },
  });
  const secondDuration = Date.now() - secondStart;
  console.log(`⚡ Second query (Cache HIT): Retrieved ${cachedUsers.length} users in ${secondDuration}ms`);
  
  process.exit(0);
}

test().catch((err) => {
  console.error('❌ Accelerate query failed:', err);
  process.exit(1);
});
