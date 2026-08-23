// Mobile nav toggle — the ONE piece of interactivity that must work with JS
// disabled being acceptable degradation only for hiding, never for access:
// nav links are plain <a> tags in the DOM regardless, so no-JS still works.
//
// A genuine external file, not an Astro-bundled/inlined <script> block: the
// site's CSP (public/.htaccess) only allows 'self' in script-src, no
// 'unsafe-inline' — Astro inlines small component scripts directly into the
// page HTML by default when there's no client-hydration runtime, which would
// make this silently blocked (and the mobile nav silently broken) in
// production while looking fine in every local/Lighthouse test, since
// .htaccess only takes effect on the real Apache host.
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.main-nav');
toggle?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(!!isOpen));
});
