/**
 * Minimal GitHub OAuth proxy for Decap CMS, running as a Cloudflare Worker.
 *
 * Decap's `backend: github` needs a small server to do the OAuth code<->token
 * exchange (GitHub won't let a static site do this directly — the client secret
 * can't live in browser JS). This Worker is that server. It implements exactly
 * the two endpoints Decap expects and nothing else.
 *
 * Setup (see ../README.md for the full walkthrough):
 *   1. Create a GitHub OAuth App at https://github.com/settings/developers
 *        Homepage URL:             https://elc.com.sa
 *        Authorization callback:   https://<your-worker-subdomain>.workers.dev/callback
 *   2. `wrangler secret put GITHUB_OAUTH_CLIENT_ID`
 *      `wrangler secret put GITHUB_OAUTH_CLIENT_SECRET`
 *   3. `wrangler deploy`
 *   4. Set `base_url` in public/admin/config.yml to the deployed Worker URL.
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      return handleAuth(url, env);
    }
    if (url.pathname === '/callback') {
      return handleCallback(url, env);
    }
    return new Response('Not found', { status: 404 });
  },
};

function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = new URL('/callback', url).toString();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo,user');
  authorizeUrl.searchParams.set('state', state);

  // State isn't validated round-trip here for simplicity (single-tenant, low-risk
  // internal tool). If this ever needs to be hardened, sign `state` and check it
  // in /callback before exchanging the code.
  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleCallback(url, env) {
  const code = url.searchParams.get('code');
  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    return renderPostMessage('error', { message: tokenData.error_description ?? 'OAuth failed' });
  }

  return renderPostMessage('success', {
    token: tokenData.access_token,
    provider: 'github',
  });
}

/**
 * Decap's popup window expects the opener to receive a postMessage in this exact
 * "authorization:<provider>:<status>:<json>" format, then it closes itself.
 * See: https://decapcms.org/docs/backends-overview/#custom-oauth-client
 */
function renderPostMessage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        function receiveMessage(e) {
          window.opener.postMessage(
            ${JSON.stringify(message)},
            e.origin
          );
          window.removeEventListener('message', receiveMessage, false);
        }
        window.addEventListener('message', receiveMessage, false);
        window.opener.postMessage('authorizing:github', '*');
      })();
    </script>
  </body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
