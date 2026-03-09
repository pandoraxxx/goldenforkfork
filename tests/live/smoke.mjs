const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000';

const sampleCodes = ['00700', '00005', '00001', '00941', '03690', '02977', '01033'];

async function fetchJson(path) {
  const url = `${API_BASE}${path}`;
  const start = Date.now();
  const res = await fetch(url);
  const latencyMs = Date.now() - start;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, latencyMs, data };
}

async function run() {
  const report = {
    at: new Date().toISOString(),
    apiBase: API_BASE,
    checks: [],
    samples: [],
    externalFailureRate: 0,
  };

  const health = await fetchJson('/api/health');
  report.checks.push({ name: 'health', ok: health.status === 200, status: health.status, latencyMs: health.latencyMs });

  const stats = await fetchJson('/api/market-stats');
  report.checks.push({
    name: 'market-stats',
    ok: stats.status === 200 && typeof stats.data?.total === 'number' && stats.data.total > 1000,
    status: stats.status,
    latencyMs: stats.latencyMs,
    total: stats.data?.total,
  });

  let failures = 0;
  for (const code of sampleCodes) {
    const detail = await fetchJson(`/api/stocks/${code}`);
    const indicators = await fetchJson(`/api/stocks/${code}/indicators`);
    const history = await fetchJson(`/api/stocks/${code}/price-history?days=90`);

    const ok = detail.status === 200 && indicators.status === 200 && history.status === 200;
    if (!ok) failures += 1;

    report.samples.push({
      code,
      ok,
      detailStatus: detail.status,
      indicatorsStatus: indicators.status,
      historyStatus: history.status,
      detailLatencyMs: detail.latencyMs,
      indicatorsLatencyMs: indicators.latencyMs,
      historyLatencyMs: history.latencyMs,
      historyPoints: Array.isArray(history.data) ? history.data.length : 0,
    });
  }

  report.externalFailureRate = Number((failures / sampleCodes.length).toFixed(4));

  console.log(JSON.stringify(report, null, 2));

  const hardFail = report.checks.some((c) => !c.ok);
  if (hardFail) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('[live-smoke] fatal', err);
  process.exitCode = 1;
});
