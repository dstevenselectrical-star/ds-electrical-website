// Booking form handler for DS Electrical fixed-price services.
// Primary: POST to our own /api/booking (logs ledger + Telegram + Brevo confirmation).
// Fallback 1: FormSubmit AJAX (third-party, used as belt-and-braces).
// Fallback 2: pre-filled mailto: (if everything else fails — offline / CORS / DNS).

(function () {
  const form = document.getElementById('bookform');
  if (!form) return;

  const PRIMARY_ENDPOINT  = 'https://www.dselectricalsw.co.uk/api/booking';
  const FALLBACK_ENDPOINT = 'https://formsubmit.co/ajax/info@dselectricalsw.co.uk';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(form).entries());
    raw.service = form.dataset.service || raw.service || 'Unknown service';
    raw.submitted_at = new Date().toISOString();
    raw.page = location.pathname;

    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Map the booking form fields into the /api/booking schema
    const payload = {
      service:  raw.service,
      name:     raw.name || '',
      email:    raw.email || '',
      phone:    raw.phone || '',
      postcode: raw.postcode || raw.address || '',
      when:     raw.dates || raw.when || '',
      notes:    [raw.beds && ('Beds: ' + raw.beds), raw.notes].filter(Boolean).join(' — '),
      source:   location.pathname,
      website:  raw.website || ''  // honeypot
    };

    let sent = false;
    try {
      const res = await fetch(PRIMARY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      sent = res.ok && json.ok === true;
    } catch (err) {
      sent = false;
    }

    if (!sent) {
      // Belt-and-braces: FormSubmit fallback so a single endpoint failure doesn't lose the lead
      try {
        const fbData = Object.assign({}, raw, {
          _subject: raw.service + ' — booking from ' + (raw.name || 'website'),
          _template: 'table',
          _captcha: 'false'
        });
        const res = await fetch(FALLBACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(fbData),
        });
        const json = await res.json().catch(() => ({}));
        sent = res.ok && (json.success === 'true' || json.success === true);
      } catch (err) { /* fall through to mailto */ }
    }

    if (sent) {
      showSuccess(payload, false);
      return;
    }

    const data = raw;

    // Fallback: mailto: with pre-filled body
    const subject = encodeURIComponent(`${data.service} — booking request from ${data.name}`);
    const body = encodeURIComponent(
      `Service: ${data.service}\n` +
      `Name: ${data.name}\n` +
      `Email: ${data.email}\n` +
      `Phone: ${data.phone}\n` +
      `Address: ${data.address || ''}\n` +
      `Beds: ${data.beds || ''}\n` +
      `Preferred dates: ${data.dates || ''}\n` +
      `Notes: ${data.notes || ''}\n\n` +
      `— Sent from ${location.href}`
    );
    window.location.href = `mailto:info@dselectricalsw.co.uk?subject=${subject}&body=${body}`;
    showSuccess(data, true);
  });

  // Build the success state with DOM methods (no innerHTML) so user-supplied
  // text is treated as plain text, not parsed as HTML.
  function showSuccess(data, viaMailto) {
    form.classList.add('sent');
    while (form.firstChild) form.removeChild(form.firstChild);

    const firstName = (data.name || 'there').split(' ')[0];

    const heading = document.createElement('div');
    heading.className = 'book-sent-msg';
    heading.textContent = `\u2713 Thanks ${firstName}, your request is in.`;

    const sub = document.createElement('p');
    sub.style.color = 'var(--text-muted)';
    sub.style.marginBottom = '1rem';
    sub.textContent = viaMailto
      ? 'Your email app just opened — hit send to deliver it.'
      : 'We\u2019ll confirm within 2 hours during working hours.';

    const tail = document.createElement('p');
    tail.style.fontSize = '.9rem';
    tail.style.color = 'var(--text-muted)';
    tail.appendChild(document.createTextNode('Need it sooner? Call '));
    const phone = document.createElement('a');
    phone.href = 'tel:07889334849';
    phone.style.color = 'var(--brass)';
    phone.style.fontWeight = '700';
    phone.textContent = '07889 334849';
    tail.appendChild(phone);
    tail.appendChild(document.createTextNode('.'));

    form.appendChild(heading);
    form.appendChild(sub);
    form.appendChild(tail);

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
