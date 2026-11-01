import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { useEffect, useState } from 'react';

/** While the player is not loaded, its state is read again this often (a safety net). */
const RECHECK_UNLOADED_MS = 500;

/**
 * Status of an audio player, like expo-audio's `useAudioPlayerStatus`, minus its blind spot.
 *
 * `useAudioPlayerStatus` starts from the status read during the first render and then only
 * follows events, listened to from an effect. A player that finishes loading in between (the
 * audio is cached, or the phone is slow to run the effect after a heavy first render) sends its
 * "loaded" event to nobody and the status stays "not loaded" for good: the play button spins
 * forever until the page is changed. Here the status is read again as soon as the listener is
 * attached, and while the player is still not loaded.
 */
export function useAudioStatus(player: AudioPlayer): AudioStatus {
  const [status, setStatus] = useState<AudioStatus>(() => player.currentStatus);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', setStatus);
    // Whatever happened before the listener was attached (this is the whole point of the hook).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(player.currentStatus);
    return () => subscription.remove();
  }, [player]);

  const loaded = status.isLoaded;
  useEffect(() => {
    if (loaded) return;
    const timer = setInterval(() => setStatus(player.currentStatus), RECHECK_UNLOADED_MS);
    return () => clearInterval(timer);
  }, [player, loaded]);

  return status;
}
