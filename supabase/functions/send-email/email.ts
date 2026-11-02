/**
 * Auth emails, in the user's interface language: the password reset code, and a generic code
 * email for the other auth actions (the app only uses the reset today). Table layout and
 * inline styles, the way email clients want them; Nunito where the client loads web fonts.
 */

export type Lang = 'fr' | 'de' | 'es' | 'it' | 'pt';
export const LANGS: Lang[] = ['fr', 'de', 'es', 'it', 'pt'];

export type Email = { subject: string; html: string; text: string };

const SITE = 'https://fabl-site.vercel.app';
const LOGO = `${SITE}/icon.png`;

/** Taleway palette (apps/mobile/src/theme/colors.ts). */
const C = {
  violet: '#6C4BF4',
  violetShade: '#4F31C9',
  violetSoft: '#EEE9FF',
  ink: '#25223A',
  inkSoft: '#6B6785',
  inkMuted: '#A5A2BA',
  line: '#E6E3F0',
  lineShade: '#D2CEE2',
  cloud: '#F7F6FC',
  white: '#FFFFFF',
};

type Texts = {
  resetSubject: (code: string) => string;
  resetPreheader: string;
  resetTitle: string;
  resetIntro: string;
  resetIgnore: string;
  codeSubject: (code: string) => string;
  codeTitle: string;
  codeIntro: string;
  codeIgnore: string;
  expiry: string;
  tagline: string;
};

const TEXTS: Record<Lang, Texts> = {
  fr: {
    resetSubject: (c) => `${c} — ton code pour changer de mot de passe`,
    resetPreheader: 'Saisis ce code dans l’app Taleway pour choisir un nouveau mot de passe.',
    resetTitle: 'Nouveau mot de passe',
    resetIntro:
      'Tu as demandé à changer le mot de passe de ton compte Taleway. Saisis ce code dans l’app :',
    resetIgnore:
      'Tu n’as rien demandé ? Ignore simplement cet email : ton mot de passe reste inchangé.',
    codeSubject: (c) => `${c} — ton code Taleway`,
    codeTitle: 'Ton code de vérification',
    codeIntro: 'Saisis ce code dans l’app Taleway :',
    codeIgnore: 'Tu n’as rien demandé ? Ignore simplement cet email.',
    expiry: 'Valable 1 heure',
    tagline: 'Apprends l’anglais en lisant des histoires.',
  },
  de: {
    resetSubject: (c) => `${c} – dein Code zum Ändern des Passworts`,
    resetPreheader: 'Gib diesen Code in der Taleway-App ein, um ein neues Passwort zu wählen.',
    resetTitle: 'Neues Passwort',
    resetIntro:
      'Du möchtest das Passwort deines Taleway-Kontos ändern. Gib diesen Code in der App ein:',
    resetIgnore:
      'Das warst du nicht? Ignoriere diese E-Mail einfach – dein Passwort bleibt unverändert.',
    codeSubject: (c) => `${c} – dein Taleway-Code`,
    codeTitle: 'Dein Bestätigungscode',
    codeIntro: 'Gib diesen Code in der Taleway-App ein:',
    codeIgnore: 'Das warst du nicht? Ignoriere diese E-Mail einfach.',
    expiry: 'Gültig für 1 Stunde',
    tagline: 'Lerne Englisch mit Geschichten.',
  },
  es: {
    resetSubject: (c) => `${c}: tu código para cambiar la contraseña`,
    resetPreheader: 'Introduce este código en la app Taleway para elegir una nueva contraseña.',
    resetTitle: 'Nueva contraseña',
    resetIntro:
      'Has pedido cambiar la contraseña de tu cuenta Taleway. Introduce este código en la app:',
    resetIgnore: '¿No lo has pedido tú? Ignora este correo: tu contraseña no cambia.',
    codeSubject: (c) => `${c}: tu código Taleway`,
    codeTitle: 'Tu código de verificación',
    codeIntro: 'Introduce este código en la app Taleway:',
    codeIgnore: '¿No lo has pedido tú? Ignora este correo.',
    expiry: 'Válido durante 1 hora',
    tagline: 'Aprende inglés leyendo historias.',
  },
  it: {
    resetSubject: (c) => `${c} – il tuo codice per cambiare la password`,
    resetPreheader: 'Inserisci questo codice nell’app Taleway per scegliere una nuova password.',
    resetTitle: 'Nuova password',
    resetIntro:
      'Hai chiesto di cambiare la password del tuo account Taleway. Inserisci questo codice nell’app:',
    resetIgnore: 'Non sei stato tu? Ignora questa email: la tua password non cambia.',
    codeSubject: (c) => `${c} – il tuo codice Taleway`,
    codeTitle: 'Il tuo codice di verifica',
    codeIntro: 'Inserisci questo codice nell’app Taleway:',
    codeIgnore: 'Non sei stato tu? Ignora questa email.',
    expiry: 'Valido per 1 ora',
    tagline: 'Impara l’inglese leggendo storie.',
  },
  pt: {
    resetSubject: (c) => `${c} – seu código para mudar a senha`,
    resetPreheader: 'Digite este código no app Taleway para escolher uma nova senha.',
    resetTitle: 'Nova senha',
    resetIntro: 'Você pediu para mudar a senha da sua conta Taleway. Digite este código no app:',
    resetIgnore: 'Não foi você? Ignore este e-mail: sua senha continua a mesma.',
    codeSubject: (c) => `${c} – seu código Taleway`,
    codeTitle: 'Seu código de verificação',
    codeIntro: 'Digite este código no app Taleway:',
    codeIgnore: 'Não foi você? Ignore este e-mail.',
    expiry: 'Válido por 1 hora',
    tagline: 'Aprenda inglês lendo histórias.',
  },
};

const FONT = `'Nunito', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The site in the email's language (French at the root). */
const siteUrl = (lang: Lang) => (lang === 'fr' ? SITE : `${SITE}/${lang}`);

/** One tile per digit, like the app's 3D cards (white face, darker bottom edge). */
function codeTiles(code: string) {
  const cells = [...code]
    .map(
      (digit) => `<td style="padding:0 4px;">
        <div style="width:44px;height:56px;line-height:56px;background:${C.white};border:2px solid ${C.line};border-bottom:5px solid ${C.lineShade};border-radius:12px;font-family:${FONT};font-size:30px;font-weight:900;color:${C.violet};text-align:center;">${escape(digit)}</div>
      </td>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>`;
}

function layout(o: {
  lang: Lang;
  preheader: string;
  title: string;
  intro: string;
  code: string;
  ignore: string;
}) {
  const t = TEXTS[o.lang];
  return `<!doctype html>
<html lang="${o.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.cloud};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cloud};">${escape(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cloud};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <!-- Brand -->
      <tr><td align="center" style="padding-bottom:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;"><img src="${LOGO}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:22px;font-weight:900;color:${C.ink};">Taleway</td>
        </tr></table>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:${C.white};border:2px solid ${C.line};border-bottom:6px solid ${C.lineShade};border-radius:24px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${C.violet};background-image:linear-gradient(135deg,${C.violet},${C.violetShade});height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:36px 32px 8px;font-family:${FONT};">
            <h1 style="margin:0 0 12px;font-size:26px;line-height:32px;font-weight:900;color:${C.ink};text-align:center;">${escape(o.title)}</h1>
            <p style="margin:0;font-size:16px;line-height:24px;font-weight:600;color:${C.inkSoft};text-align:center;">${escape(o.intro)}</p>
          </td></tr>
          <tr><td style="padding:24px 24px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.violetSoft};border-radius:18px;">
              <tr><td style="padding:24px 8px;">${codeTiles(o.code)}</td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:16px 32px 32px;font-family:${FONT};">
            <span style="display:inline-block;padding:6px 14px;background:${C.cloud};border-radius:999px;font-size:13px;font-weight:800;color:${C.inkSoft};">&#9201;&nbsp; ${escape(t.expiry)}</span>
          </td></tr>
          <tr><td style="padding:0 32px;"><div style="height:2px;background:${C.line};font-size:0;line-height:0;">&nbsp;</div></td></tr>
          <tr><td style="padding:20px 32px 28px;font-family:${FONT};">
            <p style="margin:0;font-size:14px;line-height:21px;font-weight:600;color:${C.inkMuted};text-align:center;">${escape(o.ignore)}</p>
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:13px;line-height:20px;font-weight:600;color:${C.inkMuted};">
        <a href="${siteUrl(o.lang)}" style="color:${C.violet};font-weight:800;text-decoration:none;">Taleway</a> · ${escape(t.tagline)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function plain(title: string, intro: string, code: string, expiry: string, ignore: string) {
  return `${title}\n\n${intro}\n\n${code}\n\n${expiry}\n\n${ignore}\n\n— Taleway`;
}

/** The forgotten-password code (the app asks for it, see apps/mobile/src/lib/passwordReset.ts). */
export function resetEmail(lang: Lang, code: string): Email {
  const t = TEXTS[lang];
  return {
    subject: t.resetSubject(code),
    html: layout({
      lang,
      preheader: t.resetPreheader,
      title: t.resetTitle,
      intro: t.resetIntro,
      code,
      ignore: t.resetIgnore,
    }),
    text: plain(t.resetTitle, t.resetIntro, code, t.expiry, t.resetIgnore),
  };
}

/** Any other auth action (sign-up confirmation, email change…): the code alone. */
export function codeEmail(lang: Lang, code: string): Email {
  const t = TEXTS[lang];
  return {
    subject: t.codeSubject(code),
    html: layout({
      lang,
      preheader: t.codeIntro,
      title: t.codeTitle,
      intro: t.codeIntro,
      code,
      ignore: t.codeIgnore,
    }),
    text: plain(t.codeTitle, t.codeIntro, code, t.expiry, t.codeIgnore),
  };
}
