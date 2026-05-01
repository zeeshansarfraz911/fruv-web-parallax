/* ===== FRUV™ App — Main Orchestrator ===== */

document.addEventListener('DOMContentLoaded', async () => {
  // --- Init Hero ---
  const hero = new HeroController();
  await hero.init();

  // --- Init Sections ---
  const sections = new SectionsController();

  // --- Sticky Nav Scroll Effect ---
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('#nav-links a[href^="#"]');

  function updateNavScroll() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', updateNavScroll, { passive: true });
  updateNavScroll();

  // --- Active Section Highlighting ---
  const sectionIds = ['product', 'ingredients', 'nutrition', 'reviews', 'faq', 'footer'];
  const sectionEls = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === '#' + id) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-72px 0px -50% 0px' });

  sectionEls.forEach(el => sectionObserver.observe(el));

  // --- Smooth Scroll for Nav Links ---
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
        // Close mobile menu if open
        document.getElementById('nav-links').classList.remove('open');
        document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
      }
    });
  });

  // --- Theme Toggle (Removed from UI, defaulting to dark) ---
  const savedTheme = localStorage.getItem('fruv-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // --- Mobile Hamburger ---
  const hamburger = document.getElementById('hamburger');
  const navLinksEl = document.getElementById('nav-links');
  const navClose = document.getElementById('nav-close');

  hamburger.addEventListener('click', () => {
    navLinksEl.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    navClose.style.display = 'block';
  });

  navClose.addEventListener('click', () => {
    navLinksEl.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    navClose.style.display = 'none';
  });

  // Close mobile menu on link click (handled above in smooth scroll)

  // --- Parallax effect on product image ---
  const productImage = document.getElementById('product-image');
  if (productImage) {
    window.addEventListener('scroll', () => {
      const rect = productImage.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const offset = (center - window.innerHeight / 2) * 0.05;
      productImage.style.transform = `translateY(${offset}px)`;
    }, { passive: true });
  }
});
