// Simple mobile nav toggle + prefers-reduced-motion guard for future animations
(function(){
  const btn = document.querySelector('.nav-toggle');
  const list = document.querySelector('.nav-list');
  if (!btn || !list) return;

  btn.addEventListener('click', () => {
    const isOpen = list.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close when clicking a link (mobile)
  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      list.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();
