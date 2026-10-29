export default {
  code: 'it',
  name: 'Italiano',
  slugs: {
    home: '',
    privacy: 'privacy',
    contact: 'contact',
    legal: 'legal',
    deletion: 'delete-account',
  },
  ui: {
    privacy: 'Privacy',
    contact: 'Contatti',
    legal: 'Note legali',
    privacyPolicy: 'Informativa sulla privacy',
    deletion: 'Elimina il mio account',
    language: 'Lingua',
  },
  pages: {
    home: {
      title: "Taleway — Impara l'inglese con le storie",
      description:
        "Taleway: impara l'inglese con mini-storie interattive, dal livello A1 al C2.",
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Logo di Taleway" />
    <h1>Impara l'inglese con le storie</h1>
    <p>
      Mini-storie da leggere capitolo dopo capitolo, dal livello A1 al C2, con voce narrante,
      traduzione delle parole e ripassi intelligenti.
    </p>
    <span class="badge">Presto su Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Storie</h2>
      <p>Racconti al tuo livello, divisi in capitoli brevi.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Una parola, una traduzione</h2>
      <p>Tocca una parola per tradurla: si aggiunge alla tua lista «Le mie parole».</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Ripassi</h2>
      <p>La ripetizione dilazionata ti ripropone le parole al momento giusto.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>Un obiettivo al giorno</h2>
      <p>Pochi minuti al giorno e una serie da mantenere.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Informativa sulla privacy — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Informativa sulla privacy</h1>
  <p class="updated">Ultimo aggiornamento: 29 ottobre 2026</p>

  <p>
    Questa informativa spiega quali dati raccoglie l'applicazione mobile Taleway
    («l'applicazione»), perché, e quali sono i tuoi diritti.
  </p>

  <h2>Titolare del trattamento</h2>
  <p>
    ${c.name}, imprenditore individuale (Francia), SIRET ${c.siret}, ${c.address}, Francia.<br />
    Contatto: <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Dati raccolti</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Dato</th>
          <th>Perché</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Indirizzo e-mail e password (conservata cifrata)</td>
          <td>Creare il tuo account, farti accedere, reimpostare la password</td>
        </tr>
        <tr>
          <td>Nome utente</td>
          <td>Identificarti nell'applicazione</td>
        </tr>
        <tr>
          <td>Lingua scelta e obiettivo giornaliero</td>
          <td>Mostrare l'interfaccia e le traduzioni nella tua lingua, seguire il tuo obiettivo</td>
        </tr>
        <tr>
          <td>Progressi di lettura (storie, capitoli, pagine)</td>
          <td>Riprendere la lettura da dove l'avevi lasciata</td>
        </tr>
        <tr>
          <td>Parole consultate e risultati dei ripassi</td>
          <td>Creare la tua lista «Le mie parole» e pianificare i ripassi</td>
        </tr>
        <tr>
          <td>Tempo di pratica, serie e punti</td>
          <td>Calcolare il tuo obiettivo del giorno e la tua serie</td>
        </tr>
        <tr>
          <td>Abbonamento premium (piano, stato, data di scadenza, cronologia degli acquisti)</td>
          <td>Sbloccare i contenuti premium sul tuo account, su tutti i tuoi dispositivi</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>I pagamenti sono gestiti da Google Play: non abbiamo mai accesso ai tuoi dati bancari.</p>
  <p>
    Base giuridica: l'esecuzione del servizio che richiedi creando un account o abbonandoti
    (articolo 6.1.b del GDPR).
  </p>

  <h2>Cosa non facciamo</h2>
  <ul>
    <li>Nessuna pubblicità, nessun tracker pubblicitario.</li>
    <li>Nessuno strumento di analisi di terze parti.</li>
    <li>Nessuna vendita o condivisione dei tuoi dati a fini commerciali.</li>
    <li>Nessun accesso al microfono, alla fotocamera, ai contatti o alla tua posizione.</li>
  </ul>

  <h2>Responsabili del trattamento</h2>
  <ul>
    <li><strong>Supabase</strong>: hosting del database e autenticazione.</li>
    <li>
      <strong>RevenueCat</strong> (Stati Uniti): gestione degli abbonamenti. Riceve
      l'identificativo tecnico del tuo account e la cronologia dei tuoi acquisti, mai la tua
      e-mail né i tuoi dati di lettura.
    </li>
    <li>
      <strong>Google Play</strong>: pagamento degli abbonamenti, secondo
      l'<a href="https://policies.google.com/privacy">informativa sulla privacy di Google</a>.
    </li>
  </ul>
  <p>
    Alcuni dati possono essere trasferiti al di fuori dell'Unione europea; tali trasferimenti
    sono disciplinati dalle clausole contrattuali tipo della Commissione europea.
  </p>

  <h2>Periodo di conservazione</h2>
  <p>
    I tuoi dati sono conservati finché esiste il tuo account. Alla cancellazione dell'account,
    vengono eliminati entro un massimo di 30 giorni. Google Play e RevenueCat possono conservare
    più a lungo la cronologia degli acquisti per i propri obblighi contabili e legali.
  </p>

  <h2>I tuoi diritti</h2>
  <p>
    Puoi accedere ai tuoi dati, rettificarli, cancellarli, opporti al loro trattamento o
    chiederne la portabilità scrivendo a <a href="mailto:${c.email}">${c.email}</a>. Per
    eliminare il tuo account, vedi <a href="${u.deletion}">questa pagina</a>. Puoi anche
    presentare un reclamo alla tua autorità di controllo, come il Garante per la protezione dei
    dati personali in Italia (<a href="https://www.garanteprivacy.it">garanteprivacy.it</a>) o la
    CNIL in Francia (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Sicurezza</h2>
  <p>
    Le comunicazioni tra l'applicazione e i nostri server sono cifrate (HTTPS). Ogni utente può
    accedere solo ai dati del proprio account.
  </p>

  <h2>Modifiche</h2>
  <p>
    Questa informativa può cambiare. La data in cima alla pagina indica l'ultima versione. In caso
    di discrepanze tra le traduzioni, prevale la <a href="/confidentialite">versione francese</a>.
  </p>
</article>`,
    },

    contact: {
      title: 'Contatti — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Contatti</h1>
  <p>Una domanda, un bug, un'idea per una storia? Scrivici:</p>
  <p>
    E-mail: <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, imprenditore individuale<br />
    SIRET: ${c.siret}<br />
    ${c.address}, Francia
  </p>
</article>`,
    },

    legal: {
      title: 'Note legali — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Note legali</h1>

  <h2>Editore</h2>
  <p>
    ${c.name}, imprenditore individuale (microimpresa francese)<br />
    SIRET: ${c.siret}<br />
    Indirizzo: ${c.address}, Francia<br />
    E-mail: <a href="mailto:${c.email}">${c.email}</a><br />
    Direttore della pubblicazione: ${c.name}
  </p>

  <h2>Hosting</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, Stati Uniti<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Proprietà intellettuale</h2>
  <p>
    I contenuti di questo sito e dell'applicazione Taleway (testi, storie, illustrazioni,
    registrazioni audio, logo) sono protetti. È vietata qualsiasi riproduzione senza
    autorizzazione.
  </p>

  <h2>Dati personali</h2>
  <p>Vedi l'<a href="${u.privacy}">informativa sulla privacy</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Elimina il mio account — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Eliminare il mio account Taleway</h1>

  <h2>Dall'applicazione</h2>
  <ol>
    <li>Apri Taleway e vai alla scheda <strong>Profilo</strong>.</li>
    <li>Tocca <strong>Elimina il mio account</strong> in fondo allo schermo.</li>
    <li>Conferma: il tuo account e i tuoi dati vengono cancellati immediatamente.</li>
  </ol>

  <h2>Via e-mail</h2>
  <p>Se non hai più accesso all'applicazione:</p>
  <ol>
    <li>
      Invia un'e-mail a <a href="mailto:${c.email}?subject=Eliminazione%20del%20mio%20account%20Taleway">${c.email}</a>
      con oggetto «Eliminazione del mio account Taleway».
    </li>
    <li>Inviala dall'indirizzo e-mail del tuo account Taleway (o indicalo nel messaggio).</li>
    <li>Riceverai una conferma una volta effettuata l'eliminazione.</li>
  </ol>

  <h2>Abbonamento</h2>
  <p>
    Eliminare l'account non annulla un abbonamento attivo: annullalo prima su Google Play
    (<strong>Pagamenti e abbonamenti → Abbonamenti</strong>).
  </p>

  <h2>Dati eliminati</h2>
  <p>Tutti i dati collegati al tuo account vengono cancellati definitivamente:</p>
  <ul>
    <li>indirizzo e-mail, password e nome utente;</li>
    <li>lingua e obiettivo giornaliero;</li>
    <li>progressi di lettura;</li>
    <li>lista «Le mie parole» e cronologia dei ripassi;</li>
    <li>tempo di pratica, serie e punti;</li>
    <li>stato del tuo abbonamento.</li>
  </ul>
  <p>
    Google Play e RevenueCat possono conservare la cronologia degli acquisti per i propri obblighi
    contabili e legali.
  </p>

  <h2>Tempi</h2>
  <p>Dall'applicazione, l'eliminazione è immediata. Via e-mail, avviene entro un massimo di 30 giorni. In seguito non viene conservato nessun altro dato.</p>
</article>`,
    },
  },
};
