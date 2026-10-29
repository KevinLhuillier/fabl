export default {
  code: 'en',
  name: 'English',
  slugs: {
    home: '',
    privacy: 'privacy',
    contact: 'contact',
    legal: 'legal',
    deletion: 'delete-account',
  },
  ui: {
    privacy: 'Privacy',
    contact: 'Contact',
    legal: 'Legal notice',
    privacyPolicy: 'Privacy policy',
    deletion: 'Delete my account',
    language: 'Language',
  },
  pages: {
    home: {
      title: 'Taleway — Learn English with stories',
      description: 'Taleway: learn English with interactive mini-stories, from level A1 to C2.',
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Taleway logo" />
    <h1>Learn English with stories</h1>
    <p>
      Mini-stories to read chapter by chapter, from level A1 to C2, with voice-over, word
      translations and smart reviews.
    </p>
    <span class="badge">Coming soon to Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Stories</h2>
      <p>Stories at your level, split into short chapters.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Tap a word, get a translation</h2>
      <p>Tap any word to translate it: it joins your “My words” list.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Reviews</h2>
      <p>Spaced repetition brings words back at the right time.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>A daily goal</h2>
      <p>A few minutes a day, a streak to keep going.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Privacy policy — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Privacy policy</h1>
  <p class="updated">Last updated: October 29, 2026</p>

  <p>
    This policy explains what data the Taleway mobile application (“the app”) collects, why,
    and what your rights are.
  </p>

  <h2>Data controller</h2>
  <p>
    ${c.name}, sole proprietor (France), SIRET ${c.siret}, ${c.address}, France.<br />
    Contact: <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Data collected</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Email address and password (stored encrypted)</td>
          <td>Create your account, sign you in, reset your password</td>
        </tr>
        <tr>
          <td>Username</td>
          <td>Identify you in the app</td>
        </tr>
        <tr>
          <td>Chosen language and daily goal</td>
          <td>Show the interface and translations in your language, track your goal</td>
        </tr>
        <tr>
          <td>Reading progress (stories, chapters, pages)</td>
          <td>Resume reading where you left off</td>
        </tr>
        <tr>
          <td>Words looked up and review results</td>
          <td>Build your “My words” list and schedule your reviews</td>
        </tr>
        <tr>
          <td>Practice time, streaks and points</td>
          <td>Compute your daily goal and your streak</td>
        </tr>
        <tr>
          <td>Premium subscription (plan, status, expiry date, purchase history)</td>
          <td>Unlock premium content on your account, on all your devices</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Payments are processed by Google Play: we never have access to your bank details.</p>
  <p>
    Legal basis: performance of the service you request by creating an account or subscribing
    (Article 6(1)(b) GDPR).
  </p>

  <h2>What we don't do</h2>
  <ul>
    <li>No advertising, no ad trackers.</li>
    <li>No third-party analytics.</li>
    <li>No selling or sharing of your data for commercial purposes.</li>
    <li>No access to your microphone, camera, contacts or location.</li>
  </ul>

  <h2>Processors</h2>
  <ul>
    <li><strong>Supabase</strong>: database hosting and authentication.</li>
    <li>
      <strong>RevenueCat</strong> (United States): subscription management. Receives your
      account's technical identifier and your purchase history, never your email or reading
      data.
    </li>
    <li>
      <strong>Google Play</strong>: subscription payments, under
      <a href="https://policies.google.com/privacy">Google's privacy policy</a>.
    </li>
  </ul>
  <p>
    Data may be transferred outside the European Union; such transfers are covered by the
    European Commission's standard contractual clauses.
  </p>

  <h2>Retention</h2>
  <p>
    Your data is kept as long as your account exists. When the account is deleted, it is erased
    within 30 days at most. Purchase history may be kept longer by Google Play and RevenueCat to
    meet their accounting and legal obligations.
  </p>

  <h2>Your rights</h2>
  <p>
    You can access, correct or erase your data, object to its processing or request its
    portability by writing to <a href="mailto:${c.email}">${c.email}</a>. To delete your
    account, see <a href="${u.deletion}">this page</a>. You can also lodge a complaint with your
    data protection authority, such as the CNIL in France (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Security</h2>
  <p>
    Communication between the app and our servers is encrypted (HTTPS). Each user can only
    access their own account's data.
  </p>

  <h2>Changes</h2>
  <p>
    This policy may change. The date at the top of the page shows the latest version. If the
    translations differ, the <a href="/confidentialite">French version</a> prevails.
  </p>
</article>`,
    },

    contact: {
      title: 'Contact — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Contact</h1>
  <p>A question, a bug, an idea for a story? Write to us:</p>
  <p>
    Email: <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, sole proprietor<br />
    SIRET: ${c.siret}<br />
    ${c.address}, France
  </p>
</article>`,
    },

    legal: {
      title: 'Legal notice — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Legal notice</h1>

  <h2>Publisher</h2>
  <p>
    ${c.name}, sole proprietor (French micro-enterprise)<br />
    SIRET: ${c.siret}<br />
    Address: ${c.address}, France<br />
    Email: <a href="mailto:${c.email}">${c.email}</a><br />
    Publication director: ${c.name}
  </p>

  <h2>Hosting</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, United States<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Intellectual property</h2>
  <p>
    The content of this website and of the Taleway app (texts, stories, illustrations, audio
    recordings, logo) is protected. Any reproduction without permission is prohibited.
  </p>

  <h2>Personal data</h2>
  <p>See the <a href="${u.privacy}">privacy policy</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Delete my account — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Delete my Taleway account</h1>

  <h2>From the app</h2>
  <ol>
    <li>Open Taleway and go to the <strong>Profile</strong> tab (<em>Profil</em> in French).</li>
    <li>Tap <strong>Delete my account</strong> (<em>Supprimer mon compte</em>) at the bottom of the screen.</li>
    <li>Confirm: your account and your data are erased immediately.</li>
  </ol>

  <h2>By email</h2>
  <p>If you no longer have access to the app:</p>
  <ol>
    <li>
      Send an email to <a href="mailto:${c.email}?subject=Delete%20my%20Taleway%20account">${c.email}</a>
      with the subject “Delete my Taleway account”.
    </li>
    <li>Send it from your Taleway account's email address (or include that address in the message).</li>
    <li>You will receive a confirmation once the deletion is done.</li>
  </ol>

  <h2>Subscription</h2>
  <p>
    Deleting your account does not cancel an active subscription: cancel it first in Google Play
    (<strong>Payments &amp; subscriptions → Subscriptions</strong>).
  </p>

  <h2>Data deleted</h2>
  <p>All data linked to your account is permanently erased:</p>
  <ul>
    <li>email address, password and username;</li>
    <li>language and daily goal;</li>
    <li>reading progress;</li>
    <li>“My words” list and review history;</li>
    <li>practice time, streaks and points;</li>
    <li>your subscription status.</li>
  </ul>
  <p>
    Purchase history may be kept by Google Play and RevenueCat to meet their accounting and legal
    obligations.
  </p>

  <h2>Timeframe</h2>
  <p>From the app, deletion is immediate. By email, it is done within 30 days at most. No other data is kept afterwards.</p>
</article>`,
    },
  },
};
