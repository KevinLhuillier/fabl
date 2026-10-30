import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Ad, FPS, LANDSCAPE, VERTICAL } from './Ad';

// Nunito, la police de l'appli, chargée avant le rendu de la première image.
if (typeof document !== 'undefined') {
  const handle = delayRender('Nunito');
  Promise.all(
    [
      ['Nunito_800ExtraBold.ttf', '800'],
      ['Nunito_700Bold.ttf', '700'],
    ].map(([file, weight]) =>
      new FontFace('Nunito', `url(${staticFile('fonts/' + file)})`, { weight }).load(),
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
  </>
);
