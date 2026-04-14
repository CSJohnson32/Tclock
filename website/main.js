/* ============================================================
   ENGINUITY — MAIN JS
   ============================================================ */

(function () {
  'use strict';

  // ── Sticky header on scroll ──────────────────────────────
  const header = document.getElementById('site-header');
  function updateHeader() {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();


  // ── Mobile hamburger menu ────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  hamburger.addEventListener('click', function () {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile menu when a link is clicked
  mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });


  // ── Scroll-triggered fade-up animations ─────────────────
  const fadeTargets = document.querySelectorAll(
    '.service-card, .step, .why-item, .about-card, .discipline-tag, ' +
    '.about-copy, .network-copy, .contact-copy, .contact-form, ' +
    '.section-header, .value-text'
  );

  // Add fade-up class
  fadeTargets.forEach(function (el) {
    el.classList.add('fade-up');
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  fadeTargets.forEach(function (el) {
    observer.observe(el);
  });


  // ── Staggered animation for grid items ──────────────────
  function staggerGroup(selector) {
    const items = document.querySelectorAll(selector);
    items.forEach(function (el, i) {
      el.style.transitionDelay = (i * 80) + 'ms';
    });
  }
  staggerGroup('.service-card');
  staggerGroup('.why-item');
  staggerGroup('.step');
  staggerGroup('.discipline-tag');


  // ── Contact form ─────────────────────────────────────────
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = form.querySelector('#name').value.trim();
    const email = form.querySelector('#email').value.trim();
    const message = form.querySelector('#message').value.trim();

    // Basic validation
    if (!name || !email || !message) {
      highlightEmpty(form);
      return;
    }
    if (!isValidEmail(email)) {
      const emailInput = form.querySelector('#email');
      shake(emailInput);
      emailInput.focus();
      return;
    }

    // Simulate form submission (replace with real endpoint)
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;

    setTimeout(function () {
      successMsg.classList.add('visible');
    }, 800);
  });

  function highlightEmpty(form) {
    form.querySelectorAll('[required]').forEach(function (el) {
      if (!el.value.trim()) {
        shake(el);
        el.addEventListener('input', function clearErr() {
          el.style.borderColor = '';
          el.removeEventListener('input', clearErr);
        });
      }
    });
  }

  function shake(el) {
    el.style.borderColor = '#e05252';
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 350, easing: 'ease' }
    );
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }


  // ── Smooth active nav link highlighting ─────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a:not(.btn)');

  const sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach(function (s) { sectionObserver.observe(s); });

})();
