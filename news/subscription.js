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
  const email = document.getElementById('news-email-address');
  const time = document.getElementById('news-email-time');
  const submit = document.getElementById('news-email-submit');
  const manageUnsubscribe = document.getElementById('news-email-manage-unsubscribe');
  const unsubscribe = document.getElementById('news-email-unsubscribe');
  const unsubscribeActions = document.getElementById('news-email-unsubscribe-actions');
  const keepSubscription = document.getElementById('news-email-keep-subscription');
  const resultActions = document.getElementById('news-email-result-actions');
  const verificationStatus = document.getElementById('news-email-verification-status');
  const verificationRetry = document.getElementById('news-email-verification-retry');
  const widgetContainer = document.getElementById('news-email-turnstile');
  let secureToken = '';
  let surface = 'subscribe';
  let unsubscribeFromManage = false;
  let widget;
  let challenge = '';
  let loadingWidget = false;
  let submitting = false;

  const announce = (message, error = false, followUp = '') => {
    if (followUp) {
      const followUpSpan = document.createElement('span');
      followUpSpan.className = 'news-email-follow-up';
      followUpSpan.textContent = followUp;
      status.replaceChildren(document.createTextNode(message + ' '), followUpSpan);
    } else {
      status.textContent = message;
    }
    status.dataset.error = String(error);
    status.hidden = !message;
  };
  const showResult = (message, error = false, followUp = '') => {
    form.hidden = true;
    unsubscribeActions.hidden = true;
    resultActions.hidden = surface !== 'subscribe';
    announce(message, error, followUp);
  };
  // Widget progress must never overwrite an API error or subscription result.
  const verificationMessage = (message, error = false) => {
    verificationStatus.textContent = message;
    verificationStatus.dataset.error = String(error);
    verificationStatus.hidden = !message;
  };
  const updateSubmit = () => {
    submit.disabled = submitting || (surface === 'subscribe' && !challenge);
    manageUnsubscribe.disabled = submitting;
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
    let result;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      response = await fetch(config.apiOrigin + path, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      result = await response.json();
    } catch {
      throw new Error('Unable to complete this request. Please try again later.');
    } finally {
      window.clearTimeout(timeout);
    }
    if (!result || typeof result !== 'object') {
      throw new Error('Unable to complete this request. Please try again later.');
    }
    if (!response.ok) {
      if (result.error === 'invalid_email') throw new Error('Please enter a valid email address.');
      if (result.error === 'link_expired_or_invalid' || result.error === 'invalid_link') {
        throw new Error('This link has expired or is no longer valid. Please return to AQ in the News to request a new subscription confirmation.');
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

  function verificationFailed() {
    if (surface !== 'subscribe' || form.hidden) return;
    challenge = '';
    widgetContainer.hidden = false;
    verificationRetry.hidden = false;
    updateSubmit();
    verificationMessage('Verification could not complete. Please retry verification. If it still fails, reload the page.', true);
  }

  function resetVerification(message = 'Checking security verification…') {
    if (surface !== 'subscribe' || form.hidden) return;
    challenge = '';
    widgetContainer.hidden = false;
    verificationRetry.hidden = true;
    updateSubmit();
    verificationMessage(message);
    try {
      window.turnstile.reset(widget);
    } catch {
      verificationFailed();
    }
  }

  async function loadWidget() {
    if (surface !== 'subscribe' || widget !== undefined || loadingWidget || !panelIsOpen()) return;
    if (!config.enabled || !config.turnstileSiteKey || config.turnstileSiteKey.startsWith('__')
        || !config.apiOrigin || config.apiOrigin.startsWith('__')) {
      submit.disabled = true;
      announce('Email subscriptions are not available yet.', true);
      return;
    }

    loadingWidget = true;
    verificationRetry.hidden = true;
    verificationMessage('Checking security verification…');
    try {
      if (!window.turnstile) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          const timeout = window.setTimeout(() => {
            script.remove();
            reject(new Error('Verification script timed out.'));
          }, 15000);
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.onload = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          script.onerror = () => {
            window.clearTimeout(timeout);
            script.remove();
            reject(new Error('Verification script failed to load.'));
          };
          document.head.appendChild(script);
        });
      }
      widget = window.turnstile.render('#news-email-turnstile', {
        sitekey: config.turnstileSiteKey,
        action: config.turnstileAction,
        // Prefer the shorter 300 × 65px widget; compact fits slots under 300px.
        size: widgetContainer.clientWidth >= 300 ? 'normal' : 'compact',
        appearance: 'interaction-only',
        'refresh-expired': 'manual',
        'refresh-timeout': 'manual',
        callback: value => {
          if (surface !== 'subscribe' || form.hidden) return;
          challenge = value;
          widgetContainer.hidden = true;
          verificationRetry.hidden = true;
          verificationMessage('');
          updateSubmit();
        },
        'expired-callback': () => {
          challenge = '';
          updateSubmit();
          if (!submitting) resetVerification('Verification expired. Checking again…');
        },
        'timeout-callback': () => {
          challenge = '';
          updateSubmit();
          if (!submitting) resetVerification('Verification timed out. Please complete it again.');
        },
        'error-callback': verificationFailed,
        'unsupported-callback': verificationFailed,
      });
    } catch {
      verificationFailed();
    } finally {
      loadingWidget = false;
    }
  }

  verificationRetry.addEventListener('click', () => {
    if (submitting) return;
    if (widget === undefined) void loadWidget();
    else resetVerification();
  });

  if (panel instanceof HTMLDetailsElement) {
    panel.addEventListener('toggle', () => {
      if (panel.open && surface === 'subscribe') {
        if (widget !== undefined && !challenge && !submitting) resetVerification();
        void loadWidget();
      }
    });
  }

  submit.disabled = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || submitting) return;
    submitting = true;
    updateSubmit();

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
        showResult(
          'If this address can be subscribed, please check the inbox for a confirmation email.',
          false,
          "If you don't see it, please check your Junk or Spam folder."
        );
      }
    } catch (error) {
      announce(error.message, true);
    } finally {
      submitting = false;
      if (surface === 'subscribe') {
        submit.textContent = 'Subscribe';
        challenge = '';
        if (widget !== undefined && !form.hidden) resetVerification();
        updateSubmit();
      } else {
        submit.textContent = 'Save';
        updateSubmit();
      }
    }
  });

  function showUnsubscribeConfirmation(fromManage = false) {
    if (submitting) return;
    unsubscribeFromManage = fromManage;
    surface = 'unsubscribe';
    form.hidden = true;
    resultActions.hidden = true;
    heading.hidden = false;
    heading.textContent = 'Unsubscribe from News Emails';
    unsubscribeActions.hidden = false;
    announce('Are you sure you want to unsubscribe from AQ in the News emails?');
    heading.focus();
  }

  manageUnsubscribe.addEventListener('click', () => {
    if (surface === 'manage') showUnsubscribeConfirmation(true);
  });

  keepSubscription.addEventListener('click', () => {
    if (submitting) return;
    unsubscribeActions.hidden = true;
    if (unsubscribeFromManage) {
      // Reveal the same form: do not reload or overwrite unsaved selections.
      surface = 'manage';
      heading.textContent = 'Email preferences';
      form.hidden = false;
      announce('Your subscription has not been changed. Your unsaved preferences are still shown.');
      manageUnsubscribe.focus();
    } else {
      // An unsubscribe token does not imply permission to manage preferences.
      secureToken = '';
      showResult('Your subscription has not been changed.');
      status.focus();
    }
  });

  unsubscribe.addEventListener('click', async () => {
    if (surface !== 'unsubscribe' || submitting || !secureToken) return;
    submitting = true;
    unsubscribe.disabled = true;
    keepSubscription.disabled = true;
    unsubscribe.textContent = 'Unsubscribing…';
    announce('Unsubscribing…');
    try {
      await api('/unsubscribe', { token: secureToken });
      secureToken = '';
      showResult('You have unsubscribed from AQ in the News emails.');
      status.focus();
    } catch (error) {
      announce(error.message, true);
    } finally {
      submitting = false;
      unsubscribe.textContent = 'Unsubscribe';
      unsubscribe.disabled = false;
      keepSubscription.disabled = false;
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
    // Email link surfaces use the shared News navigation rather than a return button.
    resultActions.hidden = true;
    heading.hidden = false;
    if (surface === 'manage') {
      heading.textContent = 'Email preferences';
    } else if (surface === 'unsubscribe') {
      heading.textContent = 'Unsubscribe from News Emails';
    } else {
      heading.textContent = 'Confirm News Email';
    }

    if (!/^[a-f0-9]{64}$/.test(secureToken)) {
      announce('This link has expired or is no longer valid. Please return to AQ in the News to request a new subscription confirmation.', true);
    } else if (surface === 'unsubscribe') {
      showUnsubscribeConfirmation();
    } else {
      announce(surface === 'manage' ? 'Loading your current preferences…' : 'Loading subscription verification…');
      void api(surface === 'confirm' ? '/confirm' : '/manage', { token: secureToken })
        .then(result => {
          if (surface === 'confirm') {
            secureToken = '';
            announce('Your AQ in the News email subscription is active. ' + describePreference(result));
            // Reveal the News link only after confirmation has succeeded.
            resultActions.hidden = false;
          } else {
            setPreferences(result);
            form.hidden = false;
            resultActions.hidden = true;
            email.required = false;
            email.disabled = true;
            for (const id of ['news-email-address-field', 'news-email-consent', 'news-email-verification']) {
              document.getElementById(id).hidden = true;
            }
            submit.textContent = 'Save';
            submit.classList.add('news-email-save');
            submit.disabled = false;
            manageUnsubscribe.hidden = false;
            announce('Current preference: ' + describePreference(result));
          }
        })
        .catch(error => announce(error.message, true));
    }
  } else {
    void loadWidget();
  }
})();
