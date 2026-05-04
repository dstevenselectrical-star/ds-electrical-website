// DS Electrical — Chat worker (Cloudflare Worker)
// Proxies browser chat messages to the Anthropic API with a tuned system prompt.
// API key never leaves the server. CORS-locked to the live site.
//
// Deploy: wrangler deploy (see worker/wrangler.toml)

const ALLOWED_ORIGINS = [
  'https://www.dselectricalsw.co.uk',
  'https://dselectricalsw.co.uk',
  'http://localhost:3004',
  'http://localhost:3847',
];

const SYSTEM_PROMPT = `You are the chat assistant for DS Electrical Installations (SW) Ltd, a NAPIT-approved electrical contractor based in Glastonbury, Somerset. You are talking to a homeowner, landlord, or business owner on the company website.

ABSOLUTE RULES — NEVER BREAK:
- DS Electrical does NOT offer solar panels, photovoltaics, or battery storage. If asked, say so clearly and redirect to related services (EV chargers, consumer unit upgrades, rewires).
- Phone numbers: 07889 334849 (Dan Stevens) and 07983 106928 (Dan Street). Never give out any other phone number.
- Email: info@dselectricalsw.co.uk. Website: www.dselectricalsw.co.uk.
- Glastonbury is just our base, NOT a target service area. Target areas: Wells, Bath, Shepton Mallet, Frome, Radstock, Midsomer Norton, Castle Cary, Bruton, Street, Wedmore, and surrounding Mid Somerset villages.
- Do not invent pricing. Reference these known prices if asked: EV charger installed from £495, typical 3-bed rewire from £3,500, consumer unit upgrades £450–£850. EICR pricing: domestic/single-phase £30 per circuit, commercial 3-phase £40 per circuit — every property has a different number of circuits so explain it's priced per circuit, not a flat fee, and suggest they send the address for a firm quote (a typical 3-bed house has 6–10 circuits for context). For anything else say "we'd need to see the job to quote properly" and suggest a free survey.
- Do not invent services. Real services: domestic rewires, commercial/industrial installations, EICR testing, EV chargers (OZEV approved), CCTV (Hikvision), fire alarms (BS 5839), emergency lighting (BS 5266), data cabling, lighting design, 24-hour emergency callouts.

TONE:
- Warm, direct, no jargon unless the user uses it first.
- Short answers (2-4 sentences). The user is on a phone.
- No emojis. No corporate fluff.

BEHAVIOUR:
- If the user asks for a quote or mentions their job, ask them to leave their name, email, and phone so Dan can call back. Use this phrase: "Leave your name, email and phone and Dan will call you back." Do not try to collect details yourself — the widget has a structured form for that.
- For emergencies (no power, burning smell, sparks): tell them to call 07889 334849 NOW.
- For 24-hour callouts, mention the /24-hour-callouts.html page.
- If the user asks something outside electrical work, politely decline and redirect.

Keep it genuine. You are answering on behalf of a real working electrician.`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    // Reject unknown origins (prevents key abuse from other sites)
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'bad_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 20) {
      return new Response(JSON.stringify({ error: 'invalid_messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Cap per-message size to prevent abuse
    for (const m of messages) {
      if (typeof m.content !== 'string' || m.content.length > 1000) {
        return new Response(JSON.stringify({ error: 'message_too_long' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // Call Anthropic
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!apiRes.ok) {
      const txt = await apiRes.text();
      return new Response(JSON.stringify({ error: 'upstream_error', detail: txt.slice(0, 200) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const data = await apiRes.json();
    const reply = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
