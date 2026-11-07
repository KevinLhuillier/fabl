import { setAudioModeAsync } from 'expo-audio';

// Voice-overs and pronunciations must play even with the iPhone's silent switch on.
let audioModeSet = false;
export function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch((e) => console.warn('setAudioMode', e));
}

/**
 * Back to playback after speech recognition, which switches the iOS audio session to
 * recording (sound in the earpiece, quieter).
 */
export function restorePlaybackMode() {
  audioModeSet = true;
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch((e) =>
    console.warn('setAudioMode', e),
  );
}
