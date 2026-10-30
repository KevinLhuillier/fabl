// Normalise le son des vidéos à -14 LUFS (niveau YouTube), crête vraie -1,5 dB, en deux passes.
// La vidéo est copiée telle quelle. Usage : node loudnorm.mjs out/a.mp4 [out/b.mp4 ...]
import ffmpeg from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import { renameSync } from 'node:fs';

const TARGET = 'I=-14:TP=-1.5:LRA=11';

for (const file of process.argv.slice(2)) {
  const pass1 = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=${TARGET}:print_format=json`, '-f', 'null', '-'], {
    encoding: 'utf8',
  }).stderr;
  const m = JSON.parse(pass1.slice(pass1.lastIndexOf('{'), pass1.lastIndexOf('}') + 1));
  const tmp = file.replace(/\.mp4$/, '.norm.mp4');
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-i', file, '-c:v', 'copy',
    '-af',
    `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
      `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,` +
      'aresample=48000,aformat=channel_layouts=stereo',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', tmp,
  ]);
  renameSync(tmp, file);
  const check = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  console.log(file, (check.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop());
}
