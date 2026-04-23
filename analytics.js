// DS Electrical — GA4 analytics + Core Web Vitals + tracked interactions.
// Single source of truth. To swap Measurement ID, change GA4_ID below.
(function () {
  var GA4_ID = 'G-V9K0FEC9ZD';
  if (!GA4_ID || GA4_ID === 'G-XXXXXXXXXX') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID, { anonymize_ip: true, send_page_view: true });

  // --- Core Web Vitals tracking (LCP, CLS, INP, FCP, TTFB) ---
  // Uses the web-vitals library loaded lazily from jsdelivr CDN.
  // Each metric fires once per page as a GA4 event with value/rating.
  function loadWebVitals() {
    var v = document.createElement('script');
    v.async = true;
    v.src = 'https://cdn.jsdelivr.net/npm/web-vitals@4/dist/web-vitals.attribution.iife.js';
    v.onload = function () {
      if (!window.webVitals) return;
      ['onCLS','onLCP','onINP','onFCP','onTTFB'].forEach(function(fn){
        try {
          window.webVitals[fn](function(metric){
            gtag('event', metric.name, {
              value: Math.round(metric.name === 'CLS' ? metric.delta * 1000 : metric.delta),
              metric_id: metric.id,
              metric_value: metric.value,
              metric_rating: metric.rating,
              page_path: location.pathname,
              non_interaction: true
            });
          });
        } catch (e) {}
      });
    };
    document.head.appendChild(v);
  }
  // Wait for load to avoid competing with critical resources
  if (document.readyState === 'complete') loadWebVitals();
  else window.addEventListener('load', loadWebVitals);

  // --- Conversion event tracking (phone, email, WhatsApp, form submits) ---
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      gtag('event', 'phone_click', { phone: href.slice(4), page_path: location.pathname });
    } else if (href.indexOf('mailto:') === 0) {
      gtag('event', 'email_click', { page_path: location.pathname });
    } else if (href.indexOf('wa.me/') !== -1 || href.indexOf('whatsapp') !== -1) {
      gtag('event', 'whatsapp_click', { page_path: location.pathname });
    }
  }, { passive: true });

  document.addEventListener('submit', function(e){
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var service = form.dataset.service || form.getAttribute('name') || 'form';
    gtag('event', 'form_submit', { form_name: service, page_path: location.pathname });
  }, { passive: true });
})();
