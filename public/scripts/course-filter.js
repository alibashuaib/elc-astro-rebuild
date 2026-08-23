// Client-side category filter for the courses hub.
// A genuine external file, not an Astro-bundled/inlined <script> block — see
// public/scripts/mobile-nav.js for why that distinction matters under this
// site's CSP (public/.htaccess).
//
// Progressive enhancement only: with JS disabled, every course card is already
// visible in the initial HTML (see .course-grid in the parent page).
const filterEl = document.querySelector('.course-filter');
const grid = document.querySelector('.course-grid');
const noResults = document.querySelector('.no-results');

if (filterEl && grid) {
  const cards = Array.from(grid.querySelectorAll('[data-category]'));
  const chips = Array.from(filterEl.querySelectorAll('.filter-chip'));

  filterEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    chips.forEach((c) => c.classList.toggle('is-active', c === chip));
    const filter = chip.dataset.filter;

    let visibleCount = 0;
    cards.forEach((card) => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.hidden = !match;
      if (match) visibleCount++;
    });
    if (noResults) noResults.hidden = visibleCount > 0;
  });
}
