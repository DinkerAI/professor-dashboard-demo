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
        name: 'Court Reserve Instructor Dashboard Concept',
        mode: 'fictional-data product concept',
        repository: REPOSITORY_URL,
        capabilities: [
          'class discovery',
          'local class selection',
          'coverage request simulation',
          'teaching progress',
          'teaching history',
          'instructor name reveal',
          'instructor-level policy curation',
          'play-type access and point mapping'
        ],
        limitations: [
          'no authentication',
          'no persistent storage',
          'no Court Reserve connection',
          'browser-local policy publishing only'
        ]
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API route not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

