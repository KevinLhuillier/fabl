export default {
  code: 'de',
  name: 'Deutsch',
  slugs: {
    home: '',
    privacy: 'privacy',
    contact: 'contact',
    legal: 'legal',
    deletion: 'delete-account',
  },
  ui: {
    privacy: 'Datenschutz',
    contact: 'Kontakt',
    legal: 'Impressum',
    privacyPolicy: 'Datenschutzerklärung',
    deletion: 'Mein Konto löschen',
    language: 'Sprache',
  },
  pages: {
    home: {
      title: 'Taleway — Englisch lernen mit Geschichten',
      description:
        'Taleway: Lerne Englisch mit interaktiven Kurzgeschichten, von Niveau A1 bis C2.',
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Taleway-Logo" />
    <h1>Englisch lernen mit Geschichten</h1>
    <p>
      Kurzgeschichten zum Lesen, Kapitel für Kapitel, von Niveau A1 bis C2 – mit Sprachausgabe,
      Wortübersetzungen und intelligenten Wiederholungen.
    </p>
    <span class="badge">Bald bei Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Geschichten</h2>
      <p>Geschichten auf deinem Niveau, in kurze Kapitel aufgeteilt.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Ein Wort, eine Übersetzung</h2>
      <p>Tippe auf ein Wort, um es zu übersetzen: Es landet in deiner Liste „Meine Wörter“.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Wiederholungen</h2>
      <p>Verteilte Wiederholung bringt die Wörter im richtigen Moment zurück.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>Ein Tagesziel</h2>
      <p>Ein paar Minuten am Tag und eine Serie, die du halten willst.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Datenschutzerklärung — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Datenschutzerklärung</h1>
  <p class="updated">Zuletzt aktualisiert: 29. Oktober 2026</p>

  <p>
    Diese Erklärung beschreibt, welche Daten die mobile App Taleway („die App“) erhebt, wozu,
    und welche Rechte du hast.
  </p>

  <h2>Verantwortlicher</h2>
  <p>
    ${c.name}, Einzelunternehmer (Frankreich), SIRET ${c.siret}, ${c.address}, Frankreich.<br />
    Kontakt: <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Erhobene Daten</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Daten</th>
          <th>Zweck</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>E-Mail-Adresse und Passwort (verschlüsselt gespeichert)</td>
          <td>Dein Konto erstellen, dich anmelden, dein Passwort zurücksetzen</td>
        </tr>
        <tr>
          <td>Benutzername</td>
          <td>Dich in der App identifizieren</td>
        </tr>
        <tr>
          <td>Gewählte Sprache und Tagesziel</td>
          <td>Oberfläche und Übersetzungen in deiner Sprache anzeigen, dein Ziel verfolgen</td>
        </tr>
        <tr>
          <td>Lesefortschritt (Geschichten, Kapitel, Seiten)</td>
          <td>Dort weiterlesen, wo du aufgehört hast</td>
        </tr>
        <tr>
          <td>Nachgeschlagene Wörter und Ergebnisse der Wiederholungen</td>
          <td>Deine Liste „Meine Wörter“ erstellen und deine Wiederholungen planen</td>
        </tr>
        <tr>
          <td>Übungszeit, Serien und Punkte</td>
          <td>Dein Tagesziel und deine Serie berechnen</td>
        </tr>
        <tr>
          <td>Premium-Abo (Tarif, Status, Ablaufdatum, Kaufhistorie)</td>
          <td>Premium-Inhalte für dein Konto freischalten, auf all deinen Geräten</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Zahlungen werden von Google Play abgewickelt: Wir haben nie Zugriff auf deine Bankdaten.</p>
  <p>
    Rechtsgrundlage: Erfüllung des Dienstes, den du durch die Kontoerstellung oder das Abo
    anforderst (Art. 6 Abs. 1 lit. b DSGVO).
  </p>

  <h2>Was wir nicht tun</h2>
  <ul>
    <li>Keine Werbung, keine Werbe-Tracker.</li>
    <li>Keine Analysetools von Drittanbietern.</li>
    <li>Kein Verkauf und keine Weitergabe deiner Daten zu kommerziellen Zwecken.</li>
    <li>Kein Zugriff auf Mikrofon, Kamera, Kontakte oder Standort.</li>
  </ul>

  <h2>Auftragsverarbeiter</h2>
  <ul>
    <li><strong>Supabase</strong>: Hosting der Datenbank und Authentifizierung.</li>
    <li>
      <strong>RevenueCat</strong> (USA): Verwaltung der Abos. Erhält die technische Kennung
      deines Kontos und deine Kaufhistorie, nie deine E-Mail-Adresse oder deine Lesedaten.
    </li>
    <li>
      <strong>Google Play</strong>: Bezahlung der Abos, gemäß der
      <a href="https://policies.google.com/privacy">Datenschutzerklärung von Google</a>.
    </li>
  </ul>
  <p>
    Daten können außerhalb der Europäischen Union übermittelt werden; diese Übermittlungen sind
    durch die Standardvertragsklauseln der Europäischen Kommission abgesichert.
  </p>

  <h2>Speicherdauer</h2>
  <p>
    Deine Daten werden gespeichert, solange dein Konto besteht. Nach der Löschung des Kontos
    werden sie innerhalb von höchstens 30 Tagen gelöscht. Google Play und RevenueCat können die
    Kaufhistorie länger aufbewahren, um ihre buchhalterischen und gesetzlichen Pflichten zu
    erfüllen.
  </p>

  <h2>Deine Rechte</h2>
  <p>
    Du kannst Auskunft über deine Daten verlangen, sie berichtigen oder löschen lassen, der
    Verarbeitung widersprechen oder ihre Übertragbarkeit verlangen, indem du an
    <a href="mailto:${c.email}">${c.email}</a> schreibst. Um dein Konto zu löschen, siehe
    <a href="${u.deletion}">diese Seite</a>. Du kannst dich außerdem bei einer
    Datenschutz-Aufsichtsbehörde beschweren, etwa der deines Landes oder der CNIL in Frankreich
    (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Sicherheit</h2>
  <p>
    Die Kommunikation zwischen der App und unseren Servern ist verschlüsselt (HTTPS). Jeder
    Nutzer kann nur auf die Daten seines eigenen Kontos zugreifen.
  </p>

  <h2>Änderungen</h2>
  <p>
    Diese Erklärung kann sich ändern. Das Datum oben auf der Seite zeigt die neueste Fassung. Bei
    Abweichungen zwischen den Übersetzungen ist die <a href="/confidentialite">französische
    Fassung</a> maßgeblich.
  </p>
</article>`,
    },

    contact: {
      title: 'Kontakt — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Kontakt</h1>
  <p>Eine Frage, ein Fehler, eine Idee für eine Geschichte? Schreib uns:</p>
  <p>
    E-Mail: <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, Einzelunternehmer<br />
    SIRET: ${c.siret}<br />
    ${c.address}, Frankreich
  </p>
</article>`,
    },

    legal: {
      title: 'Impressum — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Impressum</h1>

  <h2>Herausgeber</h2>
  <p>
    ${c.name}, Einzelunternehmer (französisches Kleinunternehmen)<br />
    SIRET: ${c.siret}<br />
    Anschrift: ${c.address}, Frankreich<br />
    E-Mail: <a href="mailto:${c.email}">${c.email}</a><br />
    Verantwortlich für den Inhalt: ${c.name}
  </p>

  <h2>Hosting</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, USA<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Geistiges Eigentum</h2>
  <p>
    Die Inhalte dieser Website und der App Taleway (Texte, Geschichten, Illustrationen,
    Audioaufnahmen, Logo) sind geschützt. Jede Vervielfältigung ohne Genehmigung ist untersagt.
  </p>

  <h2>Personenbezogene Daten</h2>
  <p>Siehe <a href="${u.privacy}">Datenschutzerklärung</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Mein Konto löschen — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Mein Taleway-Konto löschen</h1>

  <h2>In der App</h2>
  <ol>
    <li>Öffne Taleway und gehe zum Tab <strong>Profil</strong>.</li>
    <li>Tippe unten auf dem Bildschirm auf <strong>Mein Konto löschen</strong>.</li>
    <li>Bestätige: Dein Konto und deine Daten werden sofort gelöscht.</li>
  </ol>

  <h2>Per E-Mail</h2>
  <p>Wenn du keinen Zugriff mehr auf die App hast:</p>
  <ol>
    <li>
      Sende eine E-Mail an <a href="mailto:${c.email}?subject=L%C3%B6schung%20meines%20Taleway-Kontos">${c.email}</a>
      mit dem Betreff „Löschung meines Taleway-Kontos“.
    </li>
    <li>Sende sie von der E-Mail-Adresse deines Taleway-Kontos (oder gib diese in der Nachricht an).</li>
    <li>Du erhältst eine Bestätigung, sobald die Löschung erfolgt ist.</li>
  </ol>

  <h2>Abo</h2>
  <p>
    Das Löschen deines Kontos kündigt kein laufendes Abo: Kündige es zuerst in Google Play
    (<strong>Zahlungen &amp; Abos → Abos</strong>).
  </p>

  <h2>Gelöschte Daten</h2>
  <p>Alle mit deinem Konto verknüpften Daten werden endgültig gelöscht:</p>
  <ul>
    <li>E-Mail-Adresse, Passwort und Benutzername;</li>
    <li>Sprache und Tagesziel;</li>
    <li>Lesefortschritt;</li>
    <li>Liste „Meine Wörter“ und Verlauf der Wiederholungen;</li>
    <li>Übungszeit, Serien und Punkte;</li>
    <li>Status deines Abos.</li>
  </ul>
  <p>
    Google Play und RevenueCat können die Kaufhistorie aufbewahren, um ihre buchhalterischen und
    gesetzlichen Pflichten zu erfüllen.
  </p>

  <h2>Frist</h2>
  <p>In der App erfolgt die Löschung sofort. Per E-Mail innerhalb von höchstens 30 Tagen. Danach werden keine weiteren Daten aufbewahrt.</p>
</article>`,
    },
  },
};
