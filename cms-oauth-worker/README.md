# CMS OAuth Worker

GitHub OAuth proxy for Decap CMS (`public/admin/config.yml`, `backend: github`).
Runs as a Cloudflare Worker — free tier is enough for this traffic level.

## Setup

1. **Create a GitHub OAuth App**
   GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: `https://elc.com.sa`
   - Authorization callback URL: `https://elc-cms-oauth.<your-subdomain>.workers.dev/callback`
     (you'll know the real subdomain after step 3's first deploy — deploy once,
     copy the URL, update the OAuth App's callback URL, done)

2. **Log in to Cloudflare**
   ```sh
   npx wrangler login
   ```

3. **Deploy**
   ```sh
   cd cms-oauth-worker
   npx wrangler deploy
   ```

4. **Set the secrets** (from the GitHub OAuth App's "Client ID" / generated secret)
   ```sh
   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
   ```

5. **Point Decap at it** — in `../public/admin/config.yml`:
   ```yaml
   backend:
     name: github
     repo: alibashuaib/elc-astro-rebuild
     branch: main
     base_url: https://elc-cms-oauth.<your-subdomain>.workers.dev
     auth_endpoint: auth
   ```

6. Visit `https://elc.com.sa/admin/` (or the dev URL) and log in with GitHub.

## Why this exists

Decap CMS's `github` backend needs a server-side OAuth code↔token exchange —
the client secret can't live in the CMS's static JS. This Worker is the smallest
possible version of that server: two routes (`/auth`, `/callback`), no database,
no other dependencies.
