(() => {
  'use strict';

  const link = /^#(confirm|manage|unsubscribe)(?:=(.*))?$/.exec(window.location.hash);
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

  // Media's current email links use /news/#mode=token. Move those fragments
  // locally to the canonical page; fragments are not sent to the web server.
  if (link && currentPath === '/news') {
    window.location.replace('/news-by-email/#' + link[1] + '=' + (link[2] || ''));
    return;
  }

  const panel = document.getElementById('news-email-panel');
  const form = document.getElementById('news-email-form');
  if (!panel || !form) return;

  const config = window.UKAQ_NEWS_EMAIL || {};
  const status = document.getElementById('news-email-status');
  const heading = document.getElementById('news-email-heading');
  const pageTitle = document.getElementById('news-email-page-title');
  const email = document.getElementById('news-email-address');
  const time = document.getElementById('news-email-time');
  const submit = document.getElementById('news-email-submit');
  const unsubscribe = document.getElementById('news-email-unsubscribe');
  let secureToken = '';
  let surface = 'subscribe';
  let widget;
  let challenge = '';
  let loadingWidget = false;

  const announce = (message, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };
  const mode = () => form.elements.delivery_mode.value;
  const panelIsOpen = () => !(panel instanceof HTMLDetailsElement) || panel.open;

  for (let minutes = 0; minutes < 1440; minutes += 30) {
    const value = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' +
      String(minutes % 60).padStart(2, '0');
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
    let response;
    try {
      response = await fetch(config.apiOrigin + path, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('Unable to complete this request. Please try again later.');
    }
    let result = {};
    try {
      result = await response.json();
    } catch {
      // Use the same generic message for non-JSON service failures.
    }
    if (!response.ok) {
      if (result.error === 'invalid_email') throw new Error('Please enter a valid email address.');
      if (result.error === 'link_expired_or_invalid' || result.error === 'invalid_link') {
        throw new Error('This link has expired or is no longer valid.');
      }
      if (result.error === 'turnstile_failed') {
        throw new Error('Verification was unsuccessful. Please complete it again.');
      }
      throw new Error('Unable to complete this request. Please try again later.');
    }
    return result;
  }

  function setPreferences(result) {
    form.elements.delivery_mode.value = result.delivery_mode;
    const value = String(result.daily_time_local || '08:00').slice(0, 5);
    if (![...time.options].some(option => option.value === value)) {
      time.add(new Option(value, value));
    }
    time.value = value;
    showTime();
  }

  function describePreference(result) {
    if (result.delivery_mode === 'daily') {
      return 'Daily at ' + String(result.daily_time_local || '08:00').slice(0, 5) + ' UK time.';
    }
    return 'Immediate delivery.';
  }

  async function loadWidget() {
    if (surface !== 'subscribe' || widget !== undefined || loadingWidget || !panelIsOpen()) return;
    if (!config.enabled || !config.turnstileSiteKey) {
      submit.disabled = true;
      announce('Email subscriptions are not available yet.', true);
      return;
    }

    loadingWidget = true;
    announce('Loading subscription verification…');
    try {
      if (!window.turnstile) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      widget = window.turnstile.render('#news-email-turnstile', {
        sitekey: config.turnstileSiteKey,
        action: config.turnstileAction,
        size: 'flexible',
        callback: value => {
          challenge = value;
          submit.disabled = false;
        },
        'expired-callback': () => {
          challenge = '';
          submit.disabled = true;
        },
        'error-callback': () => {
          challenge = '';
          submit.disabled = true;
          announce('Verification could not load. Please reload the page and try again.', true);
        },
      });
    } catch {
      announce('Verification could not load. Please reload the page and try again.', true);
    } finally {
      loadingWidget = false;
    }
  }

  if (panel instanceof HTMLDetailsElement) {
    panel.addEventListener('toggle', () => {
      if (panel.open && surface === 'subscribe') {
        if (widget !== undefined && !challenge) window.turnstile.reset(widget);
        void loadWidget();
      }
    });
  }

  submit.disabled = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;

    submit.textContent = surface === 'manage' ? 'Saving…' : 'Submitting…';
    announce(surface === 'manage' ? 'Saving your preferences…' : 'Submitting your subscription request…');
    try {
      const preferences = {
        delivery_mode: mode(),
        daily_time_local: time.value,
      };
      if (surface === 'manage') {
        await api('/manage/update', { ...preferences, token: secureToken });
        announce('Your AQ in the News email preferences have been saved.');
      } else {
        if (!challenge) throw new Error('Please complete verification.');
        await api('/subscribe', {
          ...preferences,
          email: email.value.trim(),
          turnstile_token: challenge,
          consent_text_version: config.consentTextVersion,
        });
        announce("If this address can be subscribed, please check the inbox for a confirmation email. If you don't see it, please check your Junk or Spam folder.");
        form.hidden = true;
      }
    } catch (error) {
      announce(error.message, true);
    } finally {
      if (surface === 'subscribe') {
        submit.textContent = 'Subscribe';
        challenge = '';
        if (widget !== undefined) window.turnstile.reset(widget);
      } else {
        submit.textContent = 'Save preferences';
        submit.disabled = false;
      }
    }
  });

  unsubscribe.addEventListener('click', async () => {
    unsubscribe.disabled = true;
    unsubscribe.textContent = 'Unsubscribing…';
    announce('Unsubscribing…');
    try {
      await api('/unsubscribe', { token: secureToken });
      secureToken = '';
      unsubscribe.hidden = true;
      form.hidden = true;
      announce('You have unsubscribed from AQ in the News emails.');
    } catch (error) {
      announce(error.message, true);
      unsubscribe.textContent = 'Unsubscribe';
      unsubscribe.disabled = false;
    }
  });

  if (link && currentPath === '/news-by-email') {
    surface = link[1];
    secureToken = link[2] || '';
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.content = 'noindex, nofollow';
    } else {
      const privateRobots = document.createElement('meta');
      privateRobots.name = 'robots';
      privateRobots.content = 'noindex, nofollow';
      document.head.appendChild(privateRobots);
    }
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);

    form.hidden = true;
    if (surface === 'manage') {
      pageTitle.textContent = 'Manage News Emails';
      heading.textContent = 'Email preferences';
    } else if (surface === 'unsubscribe') {
      pageTitle.textContent = 'Unsubscribe from News Emails';
      heading.textContent = 'Unsubscribe from News Emails';
    } else {
      pageTitle.textContent = 'Confirm News Email';
      heading.textContent = 'Confirm News Email';
    }

    if (!/^[a-f0-9]{64}$/.test(secureToken)) {
      announce('This link has expired or is no longer valid.', true);
    } else if (surface === 'unsubscribe') {
      announce('Select Unsubscribe to stop AQ in the News emails.');
      unsubscribe.hidden = false;
    } else {
      announce(surface === 'manage' ? 'Loading your current preferences…' : 'Checking your secure link…');
      void api(surface === 'confirm' ? '/confirm' : '/manage', { token: secureToken })
        .then(result => {
          if (surface === 'confirm') {
            secureToken = '';
            pageTitle.textContent = 'News by Email';
            announce('Your AQ in the News email subscription is active. ' + describePreference(result));
          } else {
            setPreferences(result);
            form.hidden = false;
            email.required = false;
            email.disabled = true;
            for (const id of ['news-email-address-field', 'news-email-consent', 'news-email-turnstile']) {
              document.getElementById(id).hidden = true;
            }
            submit.textContent = 'Save preferences';
            submit.disabled = false;
            unsubscribe.hidden = false;
            announce('Current preference: ' + describePreference(result));
          }
        })
        .catch(error => announce(error.message, true));
    }
  } else {
    void loadWidget();
  }
})();
