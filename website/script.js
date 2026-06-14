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

  /* ── Contact form ── */
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  const error   = document.getElementById('formError');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      success.hidden = true;
      error.hidden   = true;

      const name    = form.name.value.trim();
      const email   = form.email.value.trim();
      const role    = form.role.value;
      const message = form.message.value.trim();

      if (!name || !email || !role || !message) {
        error.hidden = false;
        return;
      }

      // Encode as mailto body as a graceful fallback
      const subject = encodeURIComponent('Enginuity Network Inquiry');
      const body    = encodeURIComponent(
        'Name: '        + name                            + '\n' +
        'Email: '       + email                           + '\n' +
        'Role: '        + role                            + '\n' +
        'Discipline: '  + (form.discipline.value || 'N/A') + '\n\n' +
        'Message:\n'    + message
      );

      window.location.href = 'mailto:info@eng-pros.com?subject=' + subject + '&body=' + body;

      // Show success after a short delay (user will see the mail app open)
      setTimeout(function () {
        success.hidden = false;
        form.reset();
      }, 600);
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
