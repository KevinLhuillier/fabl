/**
 * French interface texts: the reference dictionary. Every other language
 * must provide the same keys (`Messages`). A value is a string, or a function
 * when it takes values (counts, names…).
 */

/** "2 699" with a narrow no-break space, French style (no Intl dependency). */
const number = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** French plural: 0 and 1 are singular. */
const count = (n: number, one: string, many: string) => `${number(n)} ${n > 1 ? many : one}`;

export const fr = {
  number,
  common: {
    back: 'Retour',
    continue: 'Continuer',
    close: 'Fermer',
    cancel: 'Annuler',
    gotIt: 'Compris',
    next: 'Suivant',
    skip: 'Passer',
    retry: 'Réessayer',
    chapters: (n: number) => count(n, 'chapitre', 'chapitres'),
    pages: (n: number) => count(n, 'page', 'pages'),
    words: (n: number) => count(n, 'mot', 'mots'),
    minutes: (n: number) => `${n} min`,
  },
  levels: {
    A1: 'Débutant',
    A2: 'Élémentaire',
    B1: 'Intermédiaire',
    B2: 'Intermédiaire avancé',
    C1: 'Avancé',
    C2: 'Maîtrise',
  },
  /** spaCy's universal POS tags. */
  pos: {
    NOUN: 'nom',
    PROPN: 'nom propre',
    VERB: 'verbe',
    ADJ: 'adjectif',
    ADV: 'adverbe',
    PRON: 'pronom',
    DET: 'déterminant',
    ADP: 'préposition',
    CCONJ: 'conjonction',
    SCONJ: 'conjonction',
    NUM: 'nombre',
    INTJ: 'interjection',
    PART: 'particule',
    PHRASE: 'expression',
  } as Record<string, string>,
  tabs: {
    stories: 'Histoires',
    vocabulary: 'Mes mots',
    profile: 'Profil',
  },
  signIn: {
    tagline: 'Apprends l’anglais en vivant des histoires dont tu es le héros.',
    welcomeBack: 'Content de te revoir !',
    createAccount: 'Crée ton compte',
    email: 'Email',
    password: 'Mot de passe (6 caractères min.)',
    signIn: 'Se connecter',
    signUp: 'S’inscrire',
    noAccount: 'Pas encore de compte ? Inscris-toi',
    haveAccount: 'J’ai déjà un compte',
    username: 'Pseudo',
    forgotPassword: 'Mot de passe oublié ?',
    accountCreated: 'Compte créé ! Clique sur le lien reçu par email, puis connecte-toi.',
    errors: {
      invalidCredentials: 'Email ou mot de passe incorrect.',
      emailNotConfirmed: 'Confirme ton adresse email (lien reçu par email), puis reconnecte-toi.',
      alreadyRegistered: 'Un compte existe déjà avec cet email.',
      passwordTooShort: 'Le mot de passe doit contenir au moins 6 caractères.',
      invalidEmail: 'Adresse email invalide.',
      usernameTaken: 'Ce pseudo est déjà pris.',
      invalidUsername: '3 à 20 caractères : lettres, chiffres ou _.',
      invalidCode: 'Code invalide ou expiré.',
      samePassword: 'Choisis un mot de passe différent de l’ancien.',
      tooManyRequests: 'Trop de tentatives. Réessaie dans quelques minutes.',
    },
  },
  home: {
    title: 'Tes histoires',
    toReviewToday: (n: number) => `${count(n, 'mot', 'mots')} à réviser aujourd’hui`,
    review: 'Réviser',
    loadError: (message: string) => `Impossible de charger les histoires : ${message}`,
    comingSoon: 'Bientôt de nouvelles histoires',
  },
  stats: {
    goalReached: 'Objectif atteint !',
    dailyGoal: 'Objectif du jour',
    goalToastTitle: 'Objectif du jour atteint !',
    goalToastText: (minutes: number, streak: number) =>
      `${minutes} min aujourd’hui · série : ${streak} j. Bravo !`,
  },
  storyTile: {
    a11y: (title: string, level: string, percent: number) =>
      `${title}, niveau ${level}, ${percent} % lu`,
  },
  story: {
    readingTime: (minutes: number) => `≈ ${minutes} min`,
  },
  toc: {
    contents: 'Sommaire',
    storyDone: 'Histoire terminée !',
    end: 'Fin',
    chapterA11y: (n: number, title: string) => `Chapitre ${n} : ${title}`,
    resume: (page: number, total: number) => `REPRENDRE · PAGE ${page} / ${total}`,
    start: 'COMMENCER LA LECTURE',
  },
  reader: {
    close: 'Fermer le chapitre',
    notFound: 'Chapitre introuvable : republie l’histoire.',
    header: (n: number, title: string, page: number, total: number) =>
      `CHAPITRE ${n} · ${title.toUpperCase()} · PAGE ${page}/${total}`,
    longPressHint: 'Appui long sur un mot pour écouter à partir de là',
    tapHint: 'Touche un mot pour voir sa traduction',
    finish: 'Terminer le chapitre',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    chapterTitle: (n: number, title: string) => `Chapitre ${n} · ${title}`,
    play: 'Écouter la page',
    pause: 'Mettre en pause la lecture',
  },
  wordSheet: {
    baseForm: 'forme de base : ',
    wordAlone: 'Mot seul : ',
    translationSoon: 'Traduction bientôt disponible',
    added: 'Ajouté à tes mots',
    alreadyAdded: 'Déjà dans tes mots',
  },
  vocabulary: {
    title: 'Mes mots',
    toReview: (n: number) => `${count(n, 'mot', 'mots')} à réviser`,
    allReviewed: 'Tout est révisé',
    learned: (n: number) => count(n, 'mot appris', 'mots appris'),
    review: 'Réviser',
    practice: 'S’entraîner',
    search: 'Chercher un mot ou une traduction',
    noMatch: 'Aucun mot ne correspond.',
    empty: 'Touche un mot dans une histoire pour voir sa traduction : il apparaîtra ici.',
    due: 'À réviser',
    removeA11y: (word: string) => `Retirer « ${word} »`,
    removeTitle: 'Retirer ce mot ?',
    removeMessage: (word: string) =>
      `« ${word} » ne sera plus dans tes mots ni dans tes révisions.`,
    remove: 'Retirer',
  },
  review: {
    quit: 'Quitter la révision',
    nothingTitle: 'Rien à réviser',
    nothingText: 'Lis une histoire et touche des mots pour remplir ta liste.',
    score: (correct: number, total: number) => `${correct} / ${total} bonnes réponses`,
    howDoYouSay: 'Comment dit-on en anglais…',
    whatDoesItMean: 'Que veut dire…',
    right: 'Bravo !',
    almost: 'Presque !',
    correctAnswer: 'Bonne réponse : ',
    typeEnglish: 'Écris le mot en anglais',
    typeTranslation: 'Écris la traduction',
    yourAnswer: 'Ta réponse',
    check: 'Valider',
    dontKnow: 'Je ne sais pas',
    watchSpelling: 'Attention à l’orthographe.',
    quote: (sentence: string) => `« ${sentence} »`,
  },
  celebration: {
    chapter: 'Chapitre terminé !',
    story: 'Histoire terminée !',
    review: 'Révision terminée !',
    streak: (days: number) => `Série : ${days} j`,
    goalReached: 'Objectif du jour atteint !',
    goalProgress: (minutes: number, goal: number) => `Objectif du jour : ${minutes} / ${goal} min`,
    readingTime: 'de lecture',
    reviewTime: 'de révision',
    newWords: (n: number) =>
      n === 1 ? '1 nouveau mot à apprendre' : `${n} nouveaux mots à apprendre`,
    newWordsHint: 'Ils t’attendent dans Mes mots pour ta prochaine révision.',
    nextChapter: 'Chapitre suivant',
    later: 'Plus tard',
  },
  language: {
    title: 'Choisis ta langue',
    hint: 'Pour l’application et la traduction des mots. Tu pourras la changer dans ton profil.',
  },
  username: {
    title: 'Choisis ton pseudo',
    hint: 'C’est ton nom dans Taleway. Personne d’autre ne pourra le prendre.',
  },
  forgotPassword: {
    title: 'Mot de passe oublié',
    hint: 'Entre ton email : on t’envoie un code pour choisir un nouveau mot de passe.',
    sendCode: 'Recevoir le code',
    codeSent: (email: string) => `Code envoyé à ${email}. Pense à regarder dans tes spams.`,
    code: 'Code reçu par email',
    newPassword: 'Nouveau mot de passe (6 caractères min.)',
    confirm: 'Changer le mot de passe',
    resend: 'Renvoyer le code',
  },
  dailyGoal: {
    title: 'Choisis ton objectif quotidien',
    hint: 'Combien de minutes veux-tu lire ou réviser chaque jour ? Tu pourras le changer dans ton profil.',
    perDay: 'par jour',
    /** One word per goal of DAILY_GOAL_OPTIONS. */
    levels: {
      10: 'Tranquille',
      15: 'Régulier',
      30: 'Sérieux',
      45: 'Intensif',
      60: 'Passionné',
    } as Record<number, string>,
  },
  profile: {
    title: 'Profil',
    totalTime: 'Temps total',
    currentStreak: 'Série actuelle',
    bestStreak: 'Meilleure série',
    dailyGoal: 'Objectif quotidien',
    dailyGoalHint: 'Minutes de lecture ou de révision par jour.',
    readAlong: 'Surlignage audio',
    readAlongHint: 'Surligne le texte et le mot lu pendant l’écoute.',
    language: 'Langue',
    languageHint: 'Langue de l’application et des traductions.',
    replay: 'Revoir la démo',
    signOut: 'Se déconnecter',
  },
  /** Guided tour, per screen then per step id (see `TOUR_STEPS`). */
  tour: {
    home: {
      stats: {
        title: 'Ta progression',
        text: 'Ta série de jours, ton temps total et ton objectif du jour. Lis ou révise chaque jour pour l’atteindre et garder ta série !',
      },
      stories: {
        title: 'Choisis une histoire',
        text: 'Chaque histoire a un niveau (A1, A2…). Touche une couverture pour voir ses chapitres.',
      },
      tabs: {
        title: 'Tes mots et ton profil',
        text: 'En bas, l’onglet « Mes mots » rassemble ton vocabulaire et « Profil » tes réglages.',
      },
    },
    story: {
      summary: {
        title: 'L’histoire',
        text: 'Le résumé, la durée de lecture et ton avancement dans l’histoire.',
      },
      chapters: {
        title: 'Les chapitres',
        text: 'Touche un chapitre pour le lire. Ta page est enregistrée : tu reprends où tu t’étais arrêté.',
      },
    },
    reader: {
      text: {
        title: 'Touche un mot',
        text: 'Sa traduction s’affiche et le mot est ajouté à « Mes mots » pour le réviser plus tard.',
      },
      audio: {
        title: 'Écoute la page',
        text: 'Lance la lecture : le texte est surligné au fil de la voix. Un appui long sur un mot lance l’écoute à partir de là.',
      },
      next: {
        title: 'Page suivante',
        text: 'Avance page par page. Ton temps de lecture compte pour ton objectif du jour !',
      },
    },
    vocabulary: {
      review: {
        title: 'Révise tes mots',
        text: 'Les mots reviennent juste avant que tu les oublies. Le temps de révision compte aussi pour ton objectif.',
      },
      search: {
        title: 'Retrouve un mot',
        text: 'Cherche un mot ou sa traduction. Chaque carte rappelle la phrase où tu l’as rencontré.',
      },
    },
    profile: {
      goal: {
        title: 'Ton objectif',
        text: 'Choisis combien de minutes lire ou réviser chaque jour.',
      },
      readAlong: {
        title: 'Surlignage audio',
        text: 'Préfères-tu écouter sans que le texte soit surligné ? Désactive-le ici.',
      },
      language: {
        title: 'Langue',
        text: 'Change la langue de l’application et des traductions.',
      },
      replay: {
        title: 'Revoir la démo',
        text: 'Tu peux revoir cette présentation à tout moment.',
      },
    },
  },
};

export type Messages = typeof fr;
