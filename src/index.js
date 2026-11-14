const REPOSITORY_URL = 'https://github.com/DinkerAI/professor-dashboard-demo';
const DEMO_ORIGIN = 'https://demo.forwardcanon.com';
const INSTRUCTOR_DEMO_PATH = '/court-reserve-instructor-dashboard/';

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

    if (url.hostname === 'professor.forwardcanon.com') {
      return Response.redirect(`${DEMO_ORIGIN}${INSTRUCTOR_DEMO_PATH}${url.search}`, 301);
    }

    if (url.pathname === '/court-reserve-instructor-dashboard') {
      return Response.redirect(`${url.origin}${INSTRUCTOR_DEMO_PATH}${url.search}`, 308);
    }

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        mode: 'demo',
        persistence: false,
        library: DEMO_ORIGIN,
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
        demo: `${DEMO_ORIGIN}${INSTRUCTOR_DEMO_PATH}`,
        capabilities: [
          'class discovery',
          'local class selection',
          'coverage request simulation',
          'teaching progress',
          'teaching history',
          'instructor name reveal',
          'instructor-level policy curation',
          'category and play-type access controls',
          'facility-scoped program catalog setup',
          'instructor roster administration',
          'per-instructor program history',
          'play-type point mapping',
          'discount and member-benefit incentives',
          'multi-destination membership and class conversion attribution',
          'conversion-window point multipliers'
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

