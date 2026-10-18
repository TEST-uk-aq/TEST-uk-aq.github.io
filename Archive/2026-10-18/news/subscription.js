(() => {
  'use strict';
  const config = window.UKAQ_NEWS_EMAIL || {};
  const panel = document.getElementById('news-email-panel');
  const form = document.getElementById('news-email-form');
  const status = document.getElementById('news-email-status');
  const heading = document.getElementById('news-email-heading');
  const email = document.getElementById('news-email-address');
  const time = document.getElementById('news-email-time');
  const submit = document.getElementById('news-email-submit');
  const unsubscribe = document.getElementById('news-email-unsubscribe');
  let secureToken = ''; let surface = 'subscribe'; let widget; let challenge = ''; let loadingWidget = false;
  const announce = (text, error = false) => { status.textContent = text; status.dataset.error = String(error); };
  const mode = () => form.elements.delivery_mode.value;
  for (let minutes = 0; minutes < 1440; minutes += 30) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    time.add(new Option(value, value));
  }
  time.value = '08:00';
  function showTime() {
    const daily = mode() === 'daily';
    document.getElementById('news-email-time-field').hidden = !daily;
    time.disabled = !daily;
    time.required = daily;
  }
  form.addEventListener('change', showTime);
  showTime();
  async function api(path, body) {
    const response = await fetch(`${config.apiOrigin}${path}`, {
      method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    let result = {};
    try { result = await response.json(); } catch { /* generic error below */ }
    if (!response.ok) {
      if (result.error === 'invalid_email') throw new Error('Please enter a valid email address.');
      if (result.error === 'link_expired_or_invalid' || result.error === 'invalid_link') throw new Error('This link has expired or is no longer valid.');
      if (result.error === 'turnstile_failed') throw new Error('Verification was unsuccessful. Please complete it again.');
      throw new Error('Unable to complete this request. Please try again later.');
    }
    return result;
  }
  function setPreferences(result) {
    form.elements.delivery_mode.value = result.delivery_mode;
    const value = String(result.daily_time_local || '08:00').slice(0, 5);
    if (![...time.options].some(option => option.value === value)) time.add(new Option(value, value));
    time.value = value; showTime();
  }
  function description(result) {
    return result.delivery_mode === 'daily' ? `Daily at ${String(result.daily_time_local).slice(0, 5)} UK time.` : 'Immediate delivery.';
  }
  async function loadWidget() {
    if (surface !== 'subscribe' || widget !== undefined || loadingWidget || !panel.open) return;
    if (!config.enabled || !config.turnstileSiteKey) {
      submit.disabled = true; announce('Email subscriptions are not available yet.'); return;
    }
    loadingWidget = true;
    try {
      if (!window.turnstile) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true; script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
      widget = window.turnstile.render('#news-email-turnstile', {
        sitekey: config.turnstileSiteKey, action: config.turnstileAction, size: 'flexible',
        callback: value => { challenge = value; submit.disabled = false; },
        'expired-callback': () => { challenge = ''; submit.disabled = true; },
        'error-callback': () => { challenge = ''; submit.disabled = true; announce('Verification could not load. Close and reopen this panel to retry.', true); },
      });
    } catch { announce('Verification could not load. Close and reopen this panel to retry.', true); }
    finally { loadingWidget = false; }
  }
  panel.addEventListener('toggle', () => {
    if (panel.open && surface === 'subscribe') {
      if (widget !== undefined && !challenge) window.turnstile.reset(widget);
      void loadWidget();
    }
  });
  document.getElementById('news-email-return').addEventListener('click', event => {
    event.preventDefault(); panel.open = false; panel.querySelector('summary').focus();
  });
  submit.disabled = true;
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      const preferences = { delivery_mode: mode(), daily_time_local: time.value };
      if (surface === 'manage') {
        await api('/manage/update', { ...preferences, token: secureToken });
        announce('Your AQ NEWS email preferences have been saved.');
      } else {
        if (!challenge) throw new Error('Please complete verification.');
        await api('/subscribe', { ...preferences, email: email.value.trim(), turnstile_token: challenge,
          consent_text_version: config.consentTextVersion });
        announce("If this address can be subscribed, please check the inbox for a confirmation email. If you don't see it, please check your Junk or Spam folder.");
        form.hidden = true;
      }
    } catch (error) { announce(error.message, true); }
    finally {
      if (surface === 'subscribe') { challenge = ''; if (widget !== undefined) window.turnstile.reset(widget); }
      else submit.disabled = false;
    }
  });
  unsubscribe.addEventListener('click', async () => {
    unsubscribe.disabled = true;
    try {
      await api('/unsubscribe', { token: secureToken });
      secureToken = ''; unsubscribe.hidden = true; announce('You have unsubscribed from AQ NEWS emails.');
    } catch (error) { announce(error.message, true); unsubscribe.disabled = false; }
  });
  const match = /^#(confirm|manage|unsubscribe)=([a-f0-9]{64})$/.exec(location.hash);
  if (match) {
    surface = match[1]; secureToken = match[2];
    history.replaceState(history.state, '', location.pathname + location.search);
    panel.open = true; form.hidden = true;
    heading.textContent = surface === 'manage' ? 'Manage AQ NEWS email preferences' : surface === 'unsubscribe' ? 'Unsubscribe from AQ NEWS' : 'Confirm AQ NEWS email';
    if (surface === 'unsubscribe') {
      announce('Select Unsubscribe to stop AQ NEWS emails.'); unsubscribe.hidden = false;
    } else {
      announce('Checking your secure link…');
      void api(surface === 'confirm' ? '/confirm' : '/manage', { token: secureToken }).then(result => {
        if (surface === 'confirm') { secureToken = ''; announce(`Your AQ NEWS email subscription is active. ${description(result)}`); }
        else {
          setPreferences(result); form.hidden = false; email.required = false; email.disabled = true;
          for (const id of ['news-email-address-field', 'news-email-consent', 'news-email-turnstile']) document.getElementById(id).hidden = true;
          submit.textContent = 'Save preferences'; submit.disabled = false;
          announce(`Current preference: ${description(result)}`);
        }
      }).catch(error => announce(error.message, true));
    }
  }
})();
