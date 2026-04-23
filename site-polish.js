/* site-polish.js
 * Subtle scroll-reveal + number count-up animations for DS Electrical.
 * No dependencies. Respects prefers-reduced-motion.
 */
(function() {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  /* Scroll reveal */
  var revealEls = document.querySelectorAll('.reveal, .reveal-up, .reveal-in, .reveal-stagger');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function(el) { revealObs.observe(el); });
  }

  /* Number count-up */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCount(el) {
    var target = el.getAttribute('data-count');
    if (!target) return;
    var targetNum = parseFloat(target);
    if (isNaN(targetNum)) return;
    var decimals = (target.split('.')[1] || '').length;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = parseInt(el.getAttribute('data-duration') || '1400', 10);
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var v = targetNum * easeOutCubic(t);
      el.textContent = prefix + v.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = prefix + targetNum.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(frame);
  }

  var countEls = document.querySelectorAll('[data-count]');
  if (countEls.length && 'IntersectionObserver' in window) {
    var countObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          countObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    countEls.forEach(function(el) { countObs.observe(el); });
  }

  /* Smooth scroll for in-page anchors (except # alone) */
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* Add a subtle parallax to elements with [data-parallax] */
  var parallaxEls = document.querySelectorAll('[data-parallax]');
  if (parallaxEls.length) {
    var ticking = false;
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          var y = window.scrollY;
          parallaxEls.forEach(function(el) {
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.3;
            el.style.transform = 'translate3d(0,' + (y * speed * -1) + 'px,0)';
          });
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
