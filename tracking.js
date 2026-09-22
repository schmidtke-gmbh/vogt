/* =========================================================
   Punchrocks / Sportakademie Vogt
   Consent-Management + Meta-Pixel + Conversion-Events
   Laedt den Pixel ausschliesslich nach aktiver Einwilligung.
   ========================================================= */
(function () {
  'use strict';

  var PIXEL_ID = '3270654256469271';
  var STORE_KEY = 'pr_consent_v1';
  var CONSENT_MAXAGE = 182 * 24 * 60 * 60 * 1000; /* 6 Monate */

  /* ---------- Consent-Speicher ---------- */
  function readConsent() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.status || !obj.ts) return null;
      if (Date.now() - obj.ts > CONSENT_MAXAGE) return null;
      return obj.status;
    } catch (e) { return null; }
  }
  function writeConsent(status) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ status: status, ts: Date.now() })); } catch (e) {}
  }

  /* ---------- Herkunft der Anfrage (Attribution) ----------
     Wird nur fuer die Dauer des Besuchs im sessionStorage gehalten und beim
     Absenden in versteckte Formularfelder geschrieben. Keine Cookies,
     keine Uebertragung an Dritte, beim Schliessen des Tabs geloescht. */
  var ATTRIB_KEY = 'pr_attrib';
  var ATTRIB_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function captureAttribution() {
    var stored = {};
    try {
      var raw = sessionStorage.getItem(ATTRIB_KEY);
      if (raw) stored = JSON.parse(raw) || {};
    } catch (e) {}

    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }

    var fresh = {};
    if (params) {
      ATTRIB_FIELDS.forEach(function (k) {
        var v = params.get(k);
        if (v) fresh[k] = v.slice(0, 120);
      });
      var fb = params.get('fbclid'), gc = params.get('gclid');
      if (fb) { fresh.click_id = fb.slice(0, 200); fresh.click_typ = 'fbclid'; }
      else if (gc) { fresh.click_id = gc.slice(0, 200); fresh.click_typ = 'gclid'; }
    }

    /* Neue Kampagnenparameter ueberschreiben die alten (Last Touch).
       Ohne neue Parameter bleibt die bisherige Zuordnung bestehen. */
    var hasFresh = Object.keys(fresh).length > 0;
    var data = hasFresh ? fresh : stored;

    if (!data.landingpage) {
      data.landingpage = (stored.landingpage) || (location.pathname + location.search).slice(0, 300);
    }
    if (!data.referrer) {
      var ref = stored.referrer;
      if (!ref) {
        try {
          ref = document.referrer && document.referrer.indexOf(location.host) === -1
            ? document.referrer.slice(0, 300) : '';
        } catch (e) { ref = ''; }
      }
      data.referrer = ref;
    }
    if (!data.erstkontakt) data.erstkontakt = stored.erstkontakt || new Date().toISOString();

    try { sessionStorage.setItem(ATTRIB_KEY, JSON.stringify(data)); } catch (e) {}
    return data;
  }

  function attributionQuelle(a) {
    if (a.utm_source) {
      return a.utm_source + (a.utm_medium ? ' / ' + a.utm_medium : '');
    }
    if (a.click_typ === 'fbclid') return 'meta / paid';
    if (a.click_typ === 'gclid') return 'google / cpc';
    if (!a.referrer) return 'direkt';
    try {
      var host = new URL(a.referrer).hostname.replace(/^www\./, '');
      if (/google\./.test(host)) return 'google / organisch';
      if (/bing\./.test(host)) return 'bing / organisch';
      if (/facebook|instagram/.test(host)) return host + ' / social';
      return host + ' / verweis';
    } catch (e) { return 'verweis'; }
  }

  function fillAttributionFields(form) {
    var a = captureAttribution();
    var values = {
      utm_source: a.utm_source || '',
      utm_medium: a.utm_medium || '',
      utm_campaign: a.utm_campaign || '',
      utm_content: a.utm_content || '',
      utm_term: a.utm_term || '',
      click_id: a.click_id || '',
      quelle: attributionQuelle(a),
      landingpage: a.landingpage || '',
      referrer: a.referrer || '',
      erstkontakt: a.erstkontakt || '',
      geraet: (window.innerWidth < 760 ? 'mobil' : 'desktop')
    };
    Object.keys(values).forEach(function (name) {
      var field = form.querySelector('input[name="' + name + '"]');
      if (field) field.value = values[name];
    });
  }

  /* ---------- Event-ID fuer spaetere Conversions-API-Deduplizierung ---------- */
  function newEventId() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }
  function storeEventId(id) { try { sessionStorage.setItem('pr_event_id', id); } catch (e) {} }
  function takeEventId() {
    try {
      var id = sessionStorage.getItem('pr_event_id');
      if (id) sessionStorage.removeItem('pr_event_id');
      return id;
    } catch (e) { return null; }
  }

  /* ---------- Pixel laden ---------- */
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded) return;
    pixelLoaded = true;

    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');

    firePageEvents();
  }

  /* ---------- Seitenspezifische Conversion-Events ---------- */
  var pageEventsFired = false;
  function firePageEvents() {
    if (pageEventsFired || typeof fbq !== 'function') return;
    pageEventsFired = true;

    var path = location.pathname.toLowerCase();

    if (path.indexOf('danke-probetraining') > -1) {
      var idP = takeEventId() || newEventId();
      fbq('track', 'Lead', {
        content_name: 'Probetraining',
        content_category: 'probetraining',
        value: 0.00,
        currency: 'EUR'
      }, { eventID: idP });
    } else if (path.indexOf('danke-firmen') > -1) {
      var idF = takeEventId() || newEventId();
      fbq('track', 'Lead', {
        content_name: 'Firmenanfrage',
        content_category: 'firmen',
        value: 0.00,
        currency: 'EUR'
      }, { eventID: idF });
    } else if (path.indexOf('danke-bewerbung') > -1) {
      /* Bewerbungen sind bewusst KEIN Lead-Event: sie wuerden die Ad-Optimierung verfaelschen. */
      fbq('trackCustom', 'Bewerbung', { content_name: 'Blitzbewerbung' });
    }
  }

  /* ---------- Interaktions-Events ---------- */
  var formStarted = false;
  function bindInteractionEvents() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('wa.me') > -1) {
          track('Contact', { method: 'whatsapp' });
        } else if (href.indexOf('tel:') === 0) {
          track('Contact', { method: 'phone' });
        }
      }
      var opt = e.target.closest ? e.target.closest('.mopt') : null;
      if (opt && !formStarted) {
        formStarted = true;
        trackCustom('FormularGestartet', { content_name: document.title });
      }
    }, true);

    /* Event-ID und Herkunft in die Formulare schreiben.
       Die Event-ID dient der Deduplizierung mit der Conversions API,
       die Herkunftsfelder landen ueber den Netlify-Webhook in der Lead-Tabelle. */
    document.querySelectorAll('form[data-netlify]').forEach(function (form) {
      form.addEventListener('submit', function () {
        var field = form.querySelector('input[name="event_id"]');
        var id = newEventId();
        if (field) field.value = id;
        storeEventId(id);
        fillAttributionFields(form);
      }, true);
    });
  }

  function track(name, params) { if (readConsent() === 'granted' && typeof fbq === 'function') fbq('track', name, params || {}); }
  function trackCustom(name, params) { if (readConsent() === 'granted' && typeof fbq === 'function') fbq('trackCustom', name, params || {}); }

  /* ---------- Instagram-Embeds: Zwei-Klick-Loesung ----------
     Die Videos liegen bei Instagram. Es wird nichts von Meta nachgeladen,
     solange der Besucher nicht klickt oder generell eingewilligt hat. */
  var igScriptRequested = false;

  function igLoadScript(cb) {
    if (window.instgrm && window.instgrm.Embeds) { cb(); return; }
    if (igScriptRequested) {
      var wait = setInterval(function () {
        if (window.instgrm && window.instgrm.Embeds) { clearInterval(wait); cb(); }
      }, 120);
      setTimeout(function () { clearInterval(wait); }, 12000);
      return;
    }
    igScriptRequested = true;
    var s = document.createElement('script');
    s.id = 'igEmbedJs';
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = cb;
    s.onerror = function () {
      document.querySelectorAll('.ig-ph.is-loading').forEach(function (ph) {
        ph.classList.remove('is-loading');
        var t = ph.querySelector('.ig-ph-title');
        if (t) t.textContent = 'Video konnte nicht geladen werden';
      });
    };
    document.body.appendChild(s);
  }

  function igActivate(box) {
    if (!box || box.getAttribute('data-ig-loaded') === '1') return;
    var url = box.getAttribute('data-ig-embed');
    if (!url) return;
    box.setAttribute('data-ig-loaded', '1');

    var ph = box.querySelector('.ig-ph');
    if (ph) {
      ph.classList.add('is-loading');
      var title = ph.querySelector('.ig-ph-title');
      if (title) title.textContent = 'Video wird geladen …';
    }

    igLoadScript(function () {
      var quote = document.createElement('blockquote');
      quote.className = 'instagram-media';
      quote.setAttribute('data-instgrm-permalink', url);
      quote.setAttribute('data-instgrm-version', '14');
      quote.setAttribute('style', 'margin:0;background:#000');
      if (ph) box.replaceChild(quote, ph);
      else box.insertBefore(quote, box.firstChild);
      if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
    });
  }

  function igActivateAll() {
    document.querySelectorAll('[data-ig-embed]').forEach(igActivate);
  }

  function bindIgEmbeds() {
    var boxes = document.querySelectorAll('[data-ig-embed]');
    if (!boxes.length) return;

    boxes.forEach(function (box) {
      var ph = box.querySelector('.ig-ph');
      if (!ph) return;
      ph.addEventListener('click', function () { igActivate(box); });
      ph.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); igActivate(box); }
      });
    });

    document.querySelectorAll('.ig-allow-all').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        writeConsent('granted');
        hideBanner();
        loadPixel();
        igActivateAll();
      });
    });

    /* Wer bereits eingewilligt hat, sieht die Videos ohne zweiten Klick. */
    if (readConsent() === 'granted') igActivateAll();
  }

  /* ---------- Consent-Banner ---------- */
  function injectStyles() {
    if (document.getElementById('prConsentStyles')) return;
    var css = ''
      + '#prConsent{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#141414;color:#F7F4EE;'
      + 'box-shadow:0 -8px 30px rgba(0,0,0,.35);padding:22px 24px;font-family:Montserrat,system-ui,sans-serif;'
      + 'transform:translateY(110%);transition:transform .35s ease}'
      + '#prConsent.is-open{transform:translateY(0)}'
      + '#prConsent .pc-wrap{max-width:1040px;margin:0 auto;display:flex;gap:26px;align-items:center;flex-wrap:wrap}'
      + '#prConsent .pc-text{flex:1 1 380px;min-width:260px;font-size:13.5px;line-height:1.65;color:#D8D2C6}'
      + '#prConsent .pc-text strong{display:block;font-family:Anton,Montserrat,sans-serif;font-size:16px;letter-spacing:.06em;'
      + 'text-transform:uppercase;color:#fff;margin-bottom:6px;font-weight:400}'
      + '#prConsent .pc-text a{color:#EFC04C;text-decoration:underline}'
      + '#prConsent .pc-btns{display:flex;gap:10px;flex-wrap:wrap;flex:0 0 auto}'
      + '#prConsent button{font-family:Montserrat,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.06em;'
      + 'text-transform:uppercase;border-radius:10px;padding:13px 22px;cursor:pointer;border:1px solid transparent;transition:.2s}'
      + '#prConsent .pc-ok{background:#C68A04;color:#141414}'
      + '#prConsent .pc-ok:hover{background:#EFC04C}'
      + '#prConsent .pc-no{background:transparent;color:#D8D2C6;border-color:#4A463E}'
      + '#prConsent .pc-no:hover{border-color:#8a8274;color:#fff}'
      + '.pc-settings-link{cursor:pointer}'
      + '@media(max-width:640px){#prConsent{padding:18px 16px}#prConsent .pc-btns{width:100%}#prConsent .pc-btns button{flex:1 1 auto}}';
    var s = document.createElement('style');
    s.id = 'prConsentStyles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function showBanner() {
    injectStyles();
    var existing = document.getElementById('prConsent');
    if (existing) { requestAnimationFrame(function () { existing.classList.add('is-open'); }); return; }

    var box = document.createElement('div');
    box.id = 'prConsent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'Hinweis zum Datenschutz');
    box.innerHTML = ''
      + '<div class="pc-wrap">'
      + '  <div class="pc-text">'
      + '    <strong>Kurz zum Datenschutz</strong>'
      + '    Wir setzen den Meta-Pixel ein, um zu messen, wie gut unsere Anzeigen funktionieren. Dabei werden Daten an Meta in den USA '
      + '    &uuml;bertragen. Das passiert nur, wenn du zustimmst. Du kannst deine Entscheidung jederzeit im Footer &auml;ndern. '
      + '    Mehr dazu in unserer <a href="datenschutz.html">Datenschutzerkl&auml;rung</a>.'
      + '  </div>'
      + '  <div class="pc-btns">'
      + '    <button type="button" class="pc-no">Nur n&ouml;tige</button>'
      + '    <button type="button" class="pc-ok">Einverstanden</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('is-open'); });

    box.querySelector('.pc-ok').addEventListener('click', function () {
      writeConsent('granted');
      hideBanner();
      loadPixel();
      igActivateAll();
    });
    box.querySelector('.pc-no').addEventListener('click', function () {
      writeConsent('denied');
      hideBanner();
    });
  }

  function hideBanner() {
    var box = document.getElementById('prConsent');
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400);
  }

  /* ---------- Widerrufs-Link im Footer ---------- */
  function bindManualOpeners() {
    document.querySelectorAll('.pc-open-consent').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
    });
  }

  function addSettingsLink() {
    var targets = document.querySelectorAll('a[href="datenschutz.html"]');
    targets.forEach(function (a) {
      if (a.closest('#prConsent')) return;
      if (a.parentNode.querySelector('.pc-settings-link')) return;
      var sep = document.createTextNode(' · ');
      var link = document.createElement('a');
      link.className = 'pc-settings-link';
      link.href = '#';
      link.textContent = 'Cookie-Einstellungen';
      link.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
      a.parentNode.insertBefore(link, a.nextSibling);
      a.parentNode.insertBefore(sep, link);
    });
  }

  /* ---------- Start ---------- */
  function init() {
    captureAttribution();
    bindInteractionEvents();
    addSettingsLink();
    bindManualOpeners();
    bindIgEmbeds();
    var status = readConsent();
    if (status === 'granted') loadPixel();
    else if (status !== 'denied') showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Fuer manuelles Testen in der Konsole: prConsentReset() */
  window.prConsentOpen = showBanner;
  window.prConsentReset = function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} location.reload(); };
})();
