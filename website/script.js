(function () {
  'use strict';

  /* ── Navbar: scroll behavior ── */
  const nav = document.getElementById('nav');

  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── Mobile menu toggle ── */
  const toggle = document.getElementById('navToggle');
  const menu   = document.getElementById('navMenu');

  toggle.addEventListener('click', function () {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.classList.toggle('active', open);
  });

  // Close menu on nav link click
  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('open');
      toggle.classList.remove('active');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) {
      menu.classList.remove('open');
      toggle.classList.remove('active');
    }
  });

  /* ── Scroll animations (IntersectionObserver) ── */
  const fadeEls = document.querySelectorAll('.fade-in');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    // Fallback: show everything immediately
    fadeEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── Hero video slideshow ── */
  const heroVideos = document.querySelectorAll('.hero__video');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroVideos.length > 1 && !reducedMotion) {
    let activeIndex = 0;

    setInterval(function () {
      const current = heroVideos[activeIndex];
      const nextIndex = (activeIndex + 1) % heroVideos.length;
      const next = heroVideos[nextIndex];

      current.classList.remove('is-active');
      next.classList.add('is-active');

      try { next.currentTime = 0; } catch (err) {}
      next.play().catch(function () {});

      activeIndex = nextIndex;
    }, 7000);
  }

  /* ── Mobile toggle button animation ── */
  const style = document.createElement('style');
  style.textContent = `
    .nav__toggle.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .nav__toggle.active span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .nav__toggle.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    .nav__toggle span { transition: transform .25s ease, opacity .2s; }
  `;
  document.head.appendChild(style);

  /* ── Contact form ── */
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  const error   = document.getElementById('formError');

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      success.hidden = true;
      error.hidden   = true;

      const name    = form.name.value.trim();
      const email   = form.email.value.trim();
      const service = form.service.value;
      const message = form.message.value.trim();

      if (!name || !email || !service || !message) {
        error.hidden = false;
        error.textContent = 'Please fill in all required fields.';
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try {
        const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          success.hidden = false;
          form.reset();
        } else {
          throw new Error('Server error');
        }
      } catch (err) {
        error.hidden = false;
        error.textContent = 'Something went wrong. Please email us directly at info@eng-pros.com.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    });
  }

  /* ── Career earnings chart ── */
  const chartSvg = document.getElementById('careerChartSvg');

  if (chartSvg) {
    const slider       = document.getElementById('yearSlider');
    const yearBadge     = document.getElementById('yearBadge');
    const traditionalLine = document.getElementById('traditionalLine');
    const hybridLine    = document.getElementById('hybridLine');
    const upsideBand     = document.getElementById('upsideBand');
    const markerLine     = document.getElementById('markerLine');
    const markerDot      = document.getElementById('markerDot');
    const cardTraditionalValue = document.getElementById('cardTraditionalValue');
    const cardTraditionalSub   = document.getElementById('cardTraditionalSub');
    const cardHybridValue      = document.getElementById('cardHybridValue');
    const cardHybridSub        = document.getElementById('cardHybridSub');
    const cardDiffValue        = document.getElementById('cardDiffValue');
    const cardDiffSub          = document.getElementById('cardDiffSub');

    const MIN_YEAR = 1;
    const MAX_YEAR = 30;
    const PAD_LEFT = 60, PAD_RIGHT = 20, PAD_TOP = 20, PAD_BOTTOM = 40;
    const PLOT_W = 760 - PAD_LEFT - PAD_RIGHT;
    const PLOT_H = 320 - PAD_TOP - PAD_BOTTOM;
    const MAX_SCALE = 500000;

    function traditionalSalary(y) { return 65000 + 90000 * y / (y + 7); }
    function hybridSalary(y)      { return 62000 + 8000 * y + 70 * y * y; }
    function hybridLow(y)         { return hybridSalary(y) * 0.75; }
    function hybridHigh(y)        { return hybridSalary(y) * 1.35; }

    function xForYear(y) {
      return PAD_LEFT + ((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * PLOT_W;
    }

    function yForValue(v) {
      return PAD_TOP + PLOT_H - Math.min(v, MAX_SCALE) / MAX_SCALE * PLOT_H;
    }

    function buildLinePath(fn) {
      const points = [];
      for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
        points.push(xForYear(y) + ',' + yForValue(fn(y)));
      }
      return 'M' + points.join(' L');
    }

    function buildBandPath(lowFn, highFn) {
      const top = [];
      const bottom = [];
      for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
        top.push(xForYear(y) + ',' + yForValue(highFn(y)));
      }
      for (let y = MAX_YEAR; y >= MIN_YEAR; y--) {
        bottom.push(xForYear(y) + ',' + yForValue(lowFn(y)));
      }
      return 'M' + top.join(' L') + ' L' + bottom.join(' L') + ' Z';
    }

    function formatCurrency(v) {
      if (Math.abs(v) >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
      return '$' + Math.round(v / 1000) + 'k';
    }

    function formatSignedCurrency(v) {
      const sign = v < 0 ? '-' : '+';
      return sign + formatCurrency(Math.abs(v));
    }

    traditionalLine.setAttribute('d', buildLinePath(traditionalSalary));
    hybridLine.setAttribute('d', buildLinePath(hybridSalary));
    upsideBand.setAttribute('d', buildBandPath(hybridLow, hybridHigh));

    function updateChart(year) {
      const x = xForYear(year);
      const traditionalValue = traditionalSalary(year);
      const hybridValue      = hybridSalary(year);

      markerLine.setAttribute('x1', x);
      markerLine.setAttribute('x2', x);
      markerDot.setAttribute('cx', x);
      markerDot.setAttribute('cy', yForValue(hybridValue));

      let traditionalTotal = 0;
      let hybridTotal       = 0;
      for (let y = MIN_YEAR; y <= year; y++) {
        traditionalTotal += traditionalSalary(y);
        hybridTotal       += hybridSalary(y);
      }

      yearBadge.textContent = 'Year ' + year;
      cardTraditionalValue.textContent = formatCurrency(traditionalValue);
      cardTraditionalSub.textContent   = 'Earned so far: ' + formatCurrency(traditionalTotal);
      cardHybridValue.textContent      = formatCurrency(hybridValue);
      cardHybridSub.textContent        = 'Earned so far: ' + formatCurrency(hybridTotal);
      cardDiffValue.textContent        = formatSignedCurrency(hybridValue - traditionalValue);
      cardDiffSub.textContent          = '30-yr gap: ' + formatSignedCurrency(
        (function () {
          let diff = 0;
          for (let y = MIN_YEAR; y <= MAX_YEAR; y++) diff += hybridSalary(y) - traditionalSalary(y);
          return diff;
        })()
      );
    }

    slider.addEventListener('input', function () { updateChart(Number(slider.value)); });
    updateChart(Number(slider.value));
  }

})();
