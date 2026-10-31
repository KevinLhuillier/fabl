export default {
  code: 'fr',
  name: 'Français',
  slugs: {
    home: '',
    privacy: 'confidentialite',
    contact: 'contact',
    legal: 'mentions-legales',
    deletion: 'suppression-compte',
  },
  ui: {
    privacy: 'Confidentialité',
    contact: 'Contact',
    legal: 'Mentions légales',
    privacyPolicy: 'Politique de confidentialité',
    deletion: 'Supprimer mon compte',
    language: 'Langue',
  },
  pages: {
    home: {
      title: "Taleway — Apprends l'anglais avec des histoires",
      description:
        "Taleway : apprends l'anglais grâce à des mini-histoires interactives, du niveau A1 au C2.",
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Logo Taleway" />
    <h1>Apprends l'anglais avec des histoires</h1>
    <p>
      Des mini-histoires à lire chapitre après chapitre, du niveau A1 au C2, avec voix off,
      traduction des mots et révisions intelligentes.
    </p>
    <span class="badge">Bientôt sur Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Des histoires</h2>
      <p>Des récits à ton niveau, découpés en chapitres courts.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Un mot, une traduction</h2>
      <p>Touche un mot pour le traduire : il rejoint ta liste « Mes mots ».</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Des révisions</h2>
      <p>La répétition espacée fait revenir les mots au bon moment.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>Un objectif par jour</h2>
      <p>Quelques minutes par jour, une série à entretenir.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Politique de confidentialité — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Politique de confidentialité</h1>
  <p class="updated">Dernière mise à jour : 31 octobre 2026</p>

  <p>
    Cette politique explique quelles données l'application mobile Taleway (« l'application »)
    collecte, pourquoi, et quels sont tes droits.
  </p>

  <h2>Responsable du traitement</h2>
  <p>
    ${c.name}, entrepreneur individuel, SIRET ${c.siret}, ${c.address}.<br />
    Contact : <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Données collectées</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Donnée</th>
          <th>Pourquoi</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Adresse e-mail et mot de passe (stocké chiffré)</td>
          <td>Créer ton compte, te connecter, réinitialiser ton mot de passe</td>
        </tr>
        <tr>
          <td>Pseudo</td>
          <td>T'identifier dans l'application</td>
        </tr>
        <tr>
          <td>Langue choisie et objectif quotidien</td>
          <td>Afficher l'interface et les traductions dans ta langue, suivre ton objectif</td>
        </tr>
        <tr>
          <td>Progression de lecture (histoires, chapitres, pages)</td>
          <td>Reprendre ta lecture là où tu t'es arrêté</td>
        </tr>
        <tr>
          <td>Mots consultés et résultats des révisions</td>
          <td>Construire ta liste « Mes mots » et planifier tes révisions</td>
        </tr>
        <tr>
          <td>Temps de pratique, séries et points</td>
          <td>Calculer ton objectif du jour et ta série de jours</td>
        </tr>
        <tr>
          <td>Abonnement premium (formule, statut, date d'échéance, historique des achats)</td>
          <td>Débloquer le contenu premium sur ton compte, sur tous tes appareils</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>
    Les paiements sont traités par Google Play : nous n'avons jamais accès à tes coordonnées
    bancaires.
  </p>
  <p>
    Base légale : l'exécution du service que tu demandes en créant un compte ou en t'abonnant
    (article 6.1.b du RGPD).
  </p>

  <h2>Ce que nous ne faisons pas</h2>
  <ul>
    <li>Pas de publicité, pas de traceur publicitaire.</li>
    <li>Pas d'outil d'analyse d'audience tiers.</li>
    <li>Pas de vente ni de partage de tes données à des fins commerciales.</li>
    <li>Pas d'accès à la caméra, aux contacts ni à ta position.</li>
  </ul>

  <h2>Micro et lecture à voix haute</h2>
  <p>
    Le micro n'est utilisé que lorsque tu lances la lecture à voix haute d'une page, et
    seulement pendant qu'elle est active. Ta voix est convertie en texte par le service de
    reconnaissance vocale de ton téléphone (Google sur Android, Apple sur iOS), qui peut la
    traiter sur ses serveurs selon ses propres règles de confidentialité. Taleway ne reçoit que
    le texte reconnu, s'en sert sur ton téléphone pour comparer ta lecture à la page, et ne
    conserve ni l'enregistrement ni le texte.
  </p>

  <h2>Sous-traitants</h2>
  <ul>
    <li><strong>Supabase</strong> : hébergement de la base de données et authentification.</li>
    <li>
      <strong>RevenueCat</strong> (États-Unis) : gestion des abonnements. Reçoit l'identifiant
      technique de ton compte et l'historique de tes achats, jamais ton e-mail ni tes données
      de lecture.
    </li>
    <li>
      <strong>Google Play</strong> : paiement des abonnements, selon les
      <a href="https://policies.google.com/privacy">règles de confidentialité de Google</a>.
    </li>
  </ul>
  <p>
    Des données peuvent être transférées hors de l'Union européenne ; ces transferts sont
    encadrés par les clauses contractuelles types de la Commission européenne.
  </p>

  <h2>Durée de conservation</h2>
  <p>
    Tes données sont conservées tant que ton compte existe. À la suppression du compte, elles
    sont effacées dans un délai maximum de 30 jours. L'historique des achats peut être conservé
    plus longtemps par Google Play et RevenueCat pour leurs obligations comptables et légales.
  </p>

  <h2>Tes droits</h2>
  <p>
    Tu peux accéder à tes données, les rectifier, les effacer, t'opposer à leur traitement ou
    demander leur portabilité en écrivant à <a href="mailto:${c.email}">${c.email}</a>. Pour
    supprimer ton compte, voir <a href="${u.deletion}">cette page</a>. Tu peux aussi
    introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Sécurité</h2>
  <p>
    Les échanges entre l'application et nos serveurs sont chiffrés (HTTPS). L'accès aux
    données de chaque utilisateur est limité à son propre compte.
  </p>

  <h2>Modifications</h2>
  <p>
    Cette politique peut évoluer. La date de mise à jour en haut de page indique la dernière
    version.
  </p>
</article>`,
    },

    contact: {
      title: 'Contact — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Contact</h1>
  <p>Une question, un bug, une idée d'histoire ? Écris-nous :</p>
  <p>
    E-mail : <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, entrepreneur individuel<br />
    SIRET : ${c.siret}<br />
    ${c.address}
  </p>
</article>`,
    },

    legal: {
      title: 'Mentions légales — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Mentions légales</h1>

  <h2>Éditeur</h2>
  <p>
    ${c.name}, entrepreneur individuel (micro-entreprise)<br />
    SIRET : ${c.siret}<br />
    Adresse : ${c.address}<br />
    E-mail : <a href="mailto:${c.email}">${c.email}</a><br />
    Directeur de la publication : ${c.name}
  </p>

  <h2>Hébergeur</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Propriété intellectuelle</h2>
  <p>
    Les contenus de ce site et de l'application Taleway (textes, histoires, illustrations,
    enregistrements audio, logo) sont protégés. Toute reproduction sans autorisation est
    interdite.
  </p>

  <h2>Données personnelles</h2>
  <p>Voir la <a href="${u.privacy}">politique de confidentialité</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Supprimer mon compte — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Supprimer mon compte Taleway</h1>

  <h2>Depuis l'application</h2>
  <ol>
    <li>Ouvre Taleway et va dans l'onglet <strong>Profil</strong>.</li>
    <li>Touche <strong>Supprimer mon compte</strong> en bas de l'écran.</li>
    <li>Confirme : ton compte et tes données sont effacés immédiatement.</li>
  </ol>

  <h2>Par e-mail</h2>
  <p>Si tu n'as plus accès à l'application :</p>
  <ol>
    <li>
      Envoie un e-mail à <a href="mailto:${c.email}?subject=Suppression%20de%20mon%20compte%20Taleway">${c.email}</a>
      avec pour objet « Suppression de mon compte Taleway ».
    </li>
    <li>Envoie-le depuis l'adresse e-mail de ton compte Taleway (ou indique-la dans le message).</li>
    <li>Tu reçois une confirmation une fois la suppression effectuée.</li>
  </ol>

  <h2>Abonnement</h2>
  <p>
    Supprimer ton compte n'annule pas un abonnement en cours : résilie-le d'abord dans
    Google Play (<strong>Paiements et abonnements → Abonnements</strong>).
  </p>

  <h2>Données supprimées</h2>
  <p>Toutes les données liées à ton compte sont définitivement effacées :</p>
  <ul>
    <li>adresse e-mail, mot de passe et pseudo ;</li>
    <li>langue et objectif quotidien ;</li>
    <li>progression de lecture ;</li>
    <li>liste « Mes mots » et historique des révisions ;</li>
    <li>temps de pratique, séries et points ;</li>
    <li>statut de ton abonnement.</li>
  </ul>
  <p>
    L'historique des achats peut être conservé par Google Play et RevenueCat pour leurs
    obligations comptables et légales.
  </p>

  <h2>Délai</h2>
  <p>Depuis l'application, la suppression est immédiate. Par e-mail, elle est effectuée sous 30 jours maximum. Aucune autre donnée n'est conservée ensuite.</p>
</article>`,
    },
  },
};
