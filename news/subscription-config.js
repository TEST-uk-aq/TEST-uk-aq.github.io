// Public deployment configuration only. The Pages build injects the Media email
// origin. Never add server secrets here.
window.UKAQ_NEWS_EMAIL = Object.freeze({
  enabled: true,
  apiOrigin: "__UK_AQ_MEDIA_EMAIL_PUBLIC_URL__",
  turnstileSiteKey: '0x4AAAAAADvk69amXC9V2nNx',
  turnstileAction: 'news_subscribe',
  consentTextVersion: '2026-10-05',
});
