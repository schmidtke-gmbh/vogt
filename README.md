# sportakademie-vogt.de

Website der Sportakademie Vogt (Punchrocks), Krav Maga Defcon® und Kampfsport
in Hüfingen und Rottweil.

Reines HTML, CSS und JavaScript. Kein Framework, kein Build-Schritt, keine
Abhängigkeiten. Wer eine Datei ändert und hochlädt, hat die Änderung live.

---

## Aufbau

```
.
├── index.html              Startseite
├── huefingen.html          Standortseite Hüfingen
├── rottweil.html           Standortseite Rottweil
├── kinder.html             Kindertraining
├── erwachsene.html         Erwachsenentraining
├── firmen.html             Firmenangebot, mit Anfrageformular
├── kursplan.html           Kursplan
├── ueber-uns.html          Über uns
├── karriere.html           Karriereseite
├── bewerbung.html          Blitzbewerbung, mit Formular
├── probetraining.html      Probetraining, mehrstufiges Formular
├── danke-probetraining.html   Danke-Seite, feuert Lead-Event
├── danke-firmen.html          Danke-Seite, feuert Lead-Event
├── danke-bewerbung.html       Danke-Seite, bewusst ohne Lead-Event
├── danke.html              Alte Danke-Seite, nur noch Fallback
├── impressum.html
├── datenschutz.html
├── styles.css              Gesamtes Layout
├── fonts.css               Lokale Schriften, ersetzt Google Fonts
├── app.js                  Interaktionen, Formularlogik, Validierung
├── tracking.js             Einwilligung, Meta-Pixel, Herkunftserfassung
├── netlify.toml            Netlify-Konfiguration
├── _headers                Cache- und Sicherheits-Header
├── robots.txt
├── sitemap.xml
└── assets/                 Bilder, Videos, Schriften
    └── fonts/              Anton und Montserrat als woff2, SIL OFL
```

---

## Deployment über Netlify

1. Repository auf GitHub anlegen und diesen Ordner hochladen
2. In Netlify: **Add new site → Import an existing project → GitHub**
3. Repository auswählen. Build-Einstellungen bleiben leer,
   Publish directory ist `.` (steht bereits in `netlify.toml`)
4. Domain `sportakademie-vogt.de` im vorhandenen Netlify-Projekt belassen
   bzw. auf das neue Projekt umhängen

Danach gilt: jeder Push auf den Hauptbranch veröffentlicht automatisch.
Das bisherige Hochladen per Drag-and-drop entfällt.

**Wichtig nach jedem Deployment mit geänderten Formularen:** Netlify liest
Formularfelder nur beim Deploy neu ein. Wer ein Feld hinzufügt, muss danach
einmal jedes Formular testweise absenden.

---

## Formulare

Drei Formulare laufen über Netlify Forms:

| Formularname | Seite | Danke-Seite |
|---|---|---|
| `probetraining` | probetraining.html | /danke-probetraining.html |
| `firmenanfrage` | firmen.html | /danke-firmen.html |
| `blitzbewerbung` | bewerbung.html | /danke-bewerbung.html |

Jedes Formular enthält versteckte Felder für die Herkunft des Besuchers
(`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
`click_id`, `quelle`, `landingpage`, `referrer`, `geraet`) sowie eine
`event_id` zur Deduplizierung. Diese Felder werden von `tracking.js`
beim Absenden befüllt.

Ein Outgoing Webhook je Formular schreibt die Einträge in eine
Google-Tabelle. Die Einrichtung ist in `Lead-Tabelle-Einrichtung.md`
beschrieben (liegt außerhalb dieses Repositories).

---

## Tracking und Datenschutz

Alles in `tracking.js`:

- **Meta-Pixel** (ID `3270654256469271`) lädt ausschließlich nach aktiver
  Einwilligung. Kein `noscript`-Fallback-Pixel.
- **Consent-Banner** selbst gebaut, Entscheidung liegt sechs Monate im
  `localStorage` unter `pr_consent_v1`. Widerruf über den Link
  „Cookie-Einstellungen", den das Skript selbst in den Footer setzt.
- **Events:** `PageView` überall, `Lead` auf den Danke-Seiten für
  Probetraining und Firmen, `Contact` bei Klick auf WhatsApp- und
  Telefonlinks, `FormularGestartet` bei der ersten Auswahl im Step-Formular.
  Bewerbungen feuern bewusst **kein** Lead-Event, sie würden die
  Anzeigenoptimierung verfälschen.
- **Instagram-Embeds** auf der Startseite laden erst nach Klick
  (Zwei-Klick-Lösung) oder nach allgemeiner Einwilligung.
- **Schriften** werden lokal ausgeliefert, es geht kein Request an Google.

Zum Testen in der Browser-Konsole:

```js
prConsentReset()   // Einwilligung löschen und neu laden
prConsentOpen()    // Banner erneut öffnen
```

---

## Was nicht in dieses Repository gehört

- Zugangsdaten jeder Art, insbesondere der Meta-Access-Token für die
  Conversions API und das Geheimwort der Google-Apps-Script-Web-App
- Lead-Exporte und andere personenbezogene Daten
- `.DS_Store` und ähnliche Systemdateien (stehen in `.gitignore`)

---

## Offene Punkte

- Domain-Verifizierung im Meta Business Portfolio
- Meta Conversions API über eine Netlify Function, Deduplizierung über `event_id`
- Google Analytics 4 ist in der Datenschutzerklärung bereits beschrieben,
  technisch aber noch nicht eingebunden
- Rechtsprüfung von Impressum und Datenschutzerklärung durch den Betreiber
