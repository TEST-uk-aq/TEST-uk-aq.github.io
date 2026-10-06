// Public deployment configuration only. Add the TEST Managed Turnstile site key
// and verify its hostname/action before enabling. Never add server secrets here.
window.UKAQ_NEWS_EMAIL = Object.freeze({
  enabled: false,
  apiOrigin: 'https://uk-aq-media-email.uk-aq-media.workers.dev',
  turnstileSiteKey: '',
  turnstileAction: 'news_subscribe',
  consentTextVersion: '2026-10-05',
});
