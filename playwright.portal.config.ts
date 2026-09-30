import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/portal',fullyParallel:false,workers:1,timeout:30000,
 outputDir:'.sentinel-test-pg/browser-results',
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:47831',channel:process.platform==='win32'?'msedge':undefined,
  screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
  {name:'mobile',use:{...devices['Desktop Chrome'],viewport:{width:390,height:844},isMobile:true}}],
 webServer:{command:'node --import tsx scripts/test-portal-server.ts',url:'http://127.0.0.1:47831/api/health',
  reuseExistingServer:false,timeout:30000}
});
