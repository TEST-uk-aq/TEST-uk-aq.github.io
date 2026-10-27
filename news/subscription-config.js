// Public deployment configuration only. The Pages build injects the Media email
// origin and public Turnstile site key. Never add server secrets here.
window.UKAQ_NEWS_EMAIL = Object.freeze({
  enabled: true,
  apiOrigin: "__UK_AQ_MEDIA_EMAIL_PUBLIC_URL__",
  turnstileSiteKey: "__UK_AQ_TURNSTILE_SITE_KEY__",
  turnstileAction: 'news_subscribe',
  consentTextVersion: '2026-10-05',
});
