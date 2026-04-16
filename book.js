// Booking form handler for DS Electrical fixed-price services.
// Submits to the existing /api/booking endpoint on ds-analytics (port 3005) if available,
// otherwise falls back to opening a pre-filled mailto: to info@dselectricalinstallations.co.uk.

(function () {
  const form = document.getElementById('bookform');
  if (!form) return;

  const BOOKING_ENDPOINT = '/api/booking';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.service = form.dataset.service || data.service || 'Unknown service';
    data.submitted_at = new Date().toISOString();
    data.page = location.pathname;

    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    let sent = false;
    try {
      const res = await fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      sent = res.ok;
    } catch (err) {
      sent = false;
    }

    if (sent) {
      showSuccess(data, false);
      return;
    }

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
    window.location.href = `mailto:info@dselectricalinstallations.co.uk?subject=${subject}&body=${body}`;
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
