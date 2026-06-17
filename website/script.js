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

  /* ── Mobile toggle button animation ── */
  const style = document.createElement('style');
  style.textContent = `
    .nav__toggle.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .nav__toggle.active span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .nav__toggle.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    .nav__toggle span { transition: transform .25s ease, opacity .2s; }
  `;
  document.head.appendChild(style);

  /* ── Project type card → pre-fill contact form ── */
  document.querySelectorAll('.project-card[data-service]').forEach(function (card) {
    card.addEventListener('click', function () {
      const select = document.getElementById('service');
      if (select) select.value = card.dataset.service;
    });
  });

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

  /* ── Smooth active nav highlight ── */
  const sections = document.querySelectorAll('section[id], div[id]');
  const navLinks  = document.querySelectorAll('.nav__menu a[href^="#"]');

  function setActiveLink() {
    let current = '';
    sections.forEach(function (section) {
      if (window.scrollY >= section.offsetTop - 100) {
        current = section.id;
      }
    });

    navLinks.forEach(function (link) {
      link.style.color = link.getAttribute('href') === '#' + current
        ? 'var(--gold)'
        : '';
    });
  }

  window.addEventListener('scroll', setActiveLink, { passive: true });

})();
