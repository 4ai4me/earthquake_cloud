# Gemini API Worker

This Worker keeps `GEMINI_API_KEY` outside the browser and proxies only the two validated simulator endpoints.

## Configure

1. Install dependencies from the repository root with `npm ci`.
2. Authenticate once with `npm run worker:login`.
3. Store the Gemini key with `npm run worker:secret`.
4. Update `ALLOWED_ORIGINS` in `wrangler.jsonc` if the frontend origin changes.
5. Run `npm run worker:deploy` and set the resulting URL as `VITE_API_BASE_URL` for the frontend build.

For bot protection, create a Turnstile widget, store its secret as `TURNSTILE_SECRET_KEY`, set `REQUIRE_TURNSTILE` to `true`, and provide the public site key to the frontend as `VITE_TURNSTILE_SITE_KEY`.

Never commit `.dev.vars`, `.env`, API keys, or Turnstile secret keys.
