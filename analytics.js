// DS Electrical — GA4 analytics loader
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
  gtag('config', GA4_ID, { anonymize_ip: true });
})();
