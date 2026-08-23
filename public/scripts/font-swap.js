// Swap-media trick for the async font stylesheet — a genuine external file,
// not an Astro-bundled/inlined <script> block. See mobile-nav.js for why that
// distinction matters under this site's CSP (public/.htaccess has no
// 'unsafe-inline' in script-src).
//
// media="print" makes the browser fetch the stylesheet without it blocking
// initial render; flipping to "all" only once it has actually loaded is what
// keeps this non-render-blocking (setting it immediately, at parse time,
// would defeat the whole trick).
//
// This script is loaded with `defer`, so by the time it runs the stylesheet
// may already have finished loading — `.sheet` is populated once a <link>'s
// resource is fetched and parsed regardless of whether its media currently
// matches, so checking it first (rather than only listening for a `load`
// event that may have already fired) works correctly no matter the timing.
const fontLink = document.getElementById('font-stylesheet');
if (fontLink instanceof HTMLLinkElement) {
  if (fontLink.sheet) {
    fontLink.media = 'all';
  } else {
    fontLink.addEventListener('load', () => {
      fontLink.media = 'all';
    });
  }
}
