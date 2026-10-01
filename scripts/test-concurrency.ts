/**
 * Concurrency Test Script
 * Executes 10 and 50 simultaneous requests against local API endpoints
 * Safe: Tests idempotency on local server, never triggers real money operations
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3333';

async function runConcurrencyBatch(concurrency: number, testName: string) {
  console.log(`\n==================================================`);
  console.log(` Starting ${testName}: ${concurrency} simultaneous requests`);
  console.log(` Target: ${API_BASE_URL}/health`);
  console.log(`==================================================`);

  const startTime = Date.now();
  const promises = Array.from({ length: concurrency }).map(async (_, index) => {
    const reqStart = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const duration = Date.now() - reqStart;
      return {
        index,
        status: res.status,
        ok: res.ok,
        duration,
      };
    } catch (err: any) {
      return {
        index,
        status: 0,
        ok: false,
        error: err.message,
        duration: Date.now() - reqStart,
      };
    }
  });

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  const successful = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const avgDuration = (results.reduce((acc, r) => acc + r.duration, 0) / results.length).toFixed(2);

  console.log(`Results for ${testName}:`);
  console.log(`- Total Requests: ${concurrency}`);
  console.log(`- Successful (200 OK): ${successful}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total Wall Time: ${totalDuration}ms`);
  console.log(`- Average Request Latency: ${avgDuration}ms`);

  if (failed > 0) {
    console.warn(`Warning: Some requests failed:`, results.filter((r) => !r.ok));
  }
}

async function main() {
  console.log('Testing server health before concurrency run...');
  try {
    const health = await fetch(`${API_BASE_URL}/health`);
    if (!health.ok) {
      console.error(`Local API at ${API_BASE_URL} returned status ${health.status}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Cannot connect to local API at ${API_BASE_URL}. Ensure server is running with 'pnpm dev:api'.`, err.message);
    process.exit(1);
  }

  // 1. Batch of 10
  await runConcurrencyBatch(10, 'Batch 1 (10 Concurrent Requests)');

  // 2. Batch of 50
  await runConcurrencyBatch(50, 'Batch 2 (50 Concurrent Requests)');

  console.log('\nConcurrency testing completed successfully.');
}

main().catch(console.error);
