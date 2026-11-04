import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Ad, FPS, LANDSCAPE, VERTICAL } from './Ad';
import { LECTURE_DURATION, LECTURE_FPS, ShortLecture } from './ShortLecture';
import { SHORT_DURATION, SHORT_FPS, ShortNiveau } from './ShortNiveau';

// Nunito, la police de l'appli, chargée avant le rendu de la première image.
if (typeof document !== 'undefined') {
  const handle = delayRender('Nunito');
  Promise.all(
    [
      ['Nunito_800ExtraBold.ttf', '800'],
      ['Nunito_800ExtraBold_Italic.ttf', '800', 'italic'],
      ['Nunito_400Regular.ttf', '400'],
      ['Nunito_700Bold.ttf', '700'],
      ['Nunito_900Black.ttf', '900'],
    ].map(([file, weight, style = 'normal']) =>
      new FontFace('Nunito', `url(${staticFile('fonts/' + file)})`, { weight, style }).load(),
    ),
  ).then((faces) => {
    faces.forEach((f) => document.fonts.add(f));
    continueRender(handle);
  });
}

export const Root = () => (
  <>
    <Composition
      id="TalewayAd"
      component={Ad}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={LANDSCAPE.duration}
      defaultProps={{ plan: LANDSCAPE }}
    />
    <Composition
      id="TalewayAdVertical"
      component={Ad}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={VERTICAL.duration}
      defaultProps={{ plan: VERTICAL }}
    />
    <Composition
      id="ShortNiveau"
      component={ShortNiveau}
      width={1080}
      height={1920}
      fps={SHORT_FPS}
      durationInFrames={SHORT_DURATION}
      defaultProps={{ lang: 'fr' as const }}
    />
    <Composition
      id="ShortNiveauPt"
      component={ShortNiveau}
      width={1080}
      height={1920}
      fps={SHORT_FPS}
      durationInFrames={SHORT_DURATION}
      defaultProps={{ lang: 'pt' as const }}
    />
    <Composition
      id="ShortLecture"
      component={ShortLecture}
      width={1080}
      height={1920}
      fps={LECTURE_FPS}
      durationInFrames={LECTURE_DURATION}
      defaultProps={{ lang: 'fr' as const }}
    />
    <Composition
      id="ShortLecturePt"
      component={ShortLecture}
      width={1080}
      height={1920}
      fps={LECTURE_FPS}
      durationInFrames={LECTURE_DURATION}
      defaultProps={{ lang: 'pt' as const }}
    />
  </>
);
