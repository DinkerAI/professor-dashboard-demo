const REPOSITORY_URL = 'https://github.com/DinkerAI/professor-dashboard-demo';

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        mode: 'demo',
        persistence: false,
        integrations: {
          courtReserve: false
        }
      });
    }

    if (url.pathname === '/api/meta') {
      return json({
        name: 'Professor Dashboard Portfolio Demo',
        mode: 'fictional-data reconstruction',
        repository: REPOSITORY_URL,
        capabilities: [
          'class discovery',
          'local class selection',
          'coverage request simulation',
          'teaching progress',
          'teaching history'
        ],
        limitations: [
          'no authentication',
          'no persistent storage',
          'no CourtReserve connection'
        ]
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API route not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
