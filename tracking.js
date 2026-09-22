/* =========================================================
   Punchrocks / Sportakademie Vogt
   Meta-Pixel, Conversion-Events, Herkunftserfassung
   und Instagram-Einbettungen.

   Die Einwilligung verwaltet Cookiebot (Cybot A/S).
   Dieses Skript wertet ausschliesslich den Zustand aus, den
   Cookiebot meldet, und laedt nichts ohne Einwilligung in der
   Kategorie "Marketing".
   ========================================================= */
(function () {
  'use strict';

  var PIXEL_ID = '3270654256469271';

  /* =========================================================
     Einwilligung: Zustand von Cookiebot
     ========================================================= */
  function marketingErlaubt() {
    try {
      return !!(window.Cookiebot && window.Cookiebot.consent && window.Cookiebot.consent.marketing);
    } catch (e) { return false; }
  }

  function statistikErlaubt() {
    try {
      return !!(window.Cookiebot && window.Cookiebot.consent && window.Cookiebot.consent.statistics);
    } catch (e) { return false; }
  }

  /* Cookiebot-Dialog erneut oeffnen (Widerruf und Aenderung) */
  function einstellungenOeffnen() {
    if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
      window.Cookiebot.renew();
      return true;
    }
    return false;
  }

  /* =========================================================
     Herkunft der Anfrage (Attribution)
     Nur im sessionStorage, keine Cookies, keine Uebertragung an
     Dritte, beim Schliessen des Tabs geloescht.
     ========================================================= */
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

  /* =========================================================
     Event-ID fuer die spaetere Conversions-API-Deduplizierung
     ========================================================= */
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

  /* =========================================================
     Meta-Pixel
     ========================================================= */
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded || !marketingErlaubt()) return;
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

  var pageEventsFired = false;
  function firePageEvents() {
    if (pageEventsFired || typeof fbq !== 'function') return;
    pageEventsFired = true;

    var path = location.pathname.toLowerCase();

    if (path.indexOf('danke-probetraining') > -1) {
      fbq('track', 'Lead', {
        content_name: 'Probetraining',
        content_category: 'probetraining',
        value: 0.00,
        currency: 'EUR'
      }, { eventID: takeEventId() || newEventId() });
    } else if (path.indexOf('danke-firmen') > -1) {
      fbq('track', 'Lead', {
        content_name: 'Firmenanfrage',
        content_category: 'firmen',
        value: 0.00,
        currency: 'EUR'
      }, { eventID: takeEventId() || newEventId() });
    } else if (path.indexOf('danke-bewerbung') > -1) {
      /* Bewerbungen sind bewusst KEIN Lead-Event: sie wuerden die Ad-Optimierung verfaelschen. */
      fbq('trackCustom', 'Bewerbung', { content_name: 'Blitzbewerbung' });
    }
  }

  function track(name, params) { if (marketingErlaubt() && typeof fbq === 'function') fbq('track', name, params || {}); }
  function trackCustom(name, params) { if (marketingErlaubt() && typeof fbq === 'function') fbq('trackCustom', name, params || {}); }

  /* =========================================================
     Interaktions-Events
     ========================================================= */
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

    /* Event-ID und Herkunft in die Formulare schreiben. */
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

  /* =========================================================
     Instagram-Einbettungen: Zwei-Klick-Loesung
     Ohne Klick und ohne Einwilligung geht nichts an Meta.
     ========================================================= */
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
    /* Der Klick auf das Vorschaubild ist die Einwilligung fuer genau dieses
       Video. Cookiebot soll dieses Skript deshalb nicht zusaetzlich blocken. */
    s.setAttribute('data-cookieconsent', 'ignore');
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
      ph.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return; /* Datenschutz-Link nicht abfangen */
        igActivate(box);
      });
      ph.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); igActivate(box); }
      });
    });

    document.querySelectorAll('.ig-allow-all').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (!marketingErlaubt()) { einstellungenOeffnen(); return; }
        igActivateAll();
      });
    });
  }

  /* =========================================================
     Widerrufs-Link im Footer
     ========================================================= */
  function addSettingsLink() {
    document.querySelectorAll('a[href="datenschutz.html"]').forEach(function (a) {
      if (a.closest('.ig-ph')) return;
      if (a.parentNode.querySelector('.pc-settings-link')) return;
      var sep = document.createTextNode(' · ');
      var link = document.createElement('a');
      link.className = 'pc-settings-link';
      link.href = '#';
      link.textContent = 'Cookie-Einstellungen';
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (!einstellungenOeffnen()) location.href = 'datenschutz.html#consent';
      });
      a.parentNode.insertBefore(link, a.nextSibling);
      a.parentNode.insertBefore(sep, link);
    });

    document.querySelectorAll('.pc-open-consent').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); einstellungenOeffnen(); });
    });
  }

  /* =========================================================
     Reaktion auf die Einwilligung
     ========================================================= */
  function consentAuswerten() {
    if (marketingErlaubt()) {
      loadPixel();
      igActivateAll();
    }
  }

  window.addEventListener('CookiebotOnConsentReady', consentAuswerten);
  window.addEventListener('CookiebotOnAccept', consentAuswerten);
  window.addEventListener('CookiebotOnDecline', function () { /* nichts laden */ });

  /* Solange der Einwilligungsdialog offen ist, blenden wir die mobile
     Aktionsleiste aus. Sonst liegen zwei Leisten uebereinander. */
  function dialogOffen(offen) {
    if (!document.body) return;
    document.body.classList.toggle('cb-dialog-open', !!offen);
  }
  window.addEventListener('CookiebotOnDialogDisplay', function () { dialogOffen(true); });
  window.addEventListener('CookiebotOnDialogInit', function () {
    /* Cookiebot meldet den Dialog als initialisiert, auch wenn er verborgen bleibt. */
    setTimeout(function () {
      var d = document.getElementById('CybotCookiebotDialog');
      dialogOffen(d && d.offsetParent !== null);
    }, 60);
  });
  window.addEventListener('CookiebotOnAccept', function () { dialogOffen(false); });
  window.addEventListener('CookiebotOnDecline', function () { dialogOffen(false); });

  /* =========================================================
     Start
     ========================================================= */
  function init() {
    captureAttribution();
    bindInteractionEvents();
    addSettingsLink();
    bindIgEmbeds();
    /* Falls Cookiebot bereits vor diesem Skript fertig war */
    consentAuswerten();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Hilfen zum Testen in der Browser-Konsole */
  window.prConsentOpen = einstellungenOeffnen;
  window.prConsentStatus = function () {
    return {
      marketing: marketingErlaubt(),
      statistik: statistikErlaubt(),
      pixelGeladen: pixelLoaded
    };
  };
})();
