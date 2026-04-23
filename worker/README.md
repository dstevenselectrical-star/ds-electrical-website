# DS Electrical — Chat Worker

Cloudflare Worker that proxies the website chat widget to the Anthropic API.
Keeps the API key server-side and locks down CORS to the live site.

## Deploy

```bash
cd worker
npx wrangler login                    # one-off, opens browser
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when prompted
npx wrangler deploy
```

After the first deploy, wrangler prints the Worker URL (e.g. `https://ds-electrical-chat.YOURSUBDOMAIN.workers.dev`). Copy it.

## Wire to the widget

In `/chat-widget.js`, set `CHAT_WORKER_URL` at the top of the IIFE to your deployed URL.

## Updating the system prompt

Edit `chat-worker.js` → `SYSTEM_PROMPT` and re-run `npx wrangler deploy`.
