// ponytail: audio/ holds no clips yet, so this stays silent on a 404. Swap in AudioContext only if
// overlapping or gapless sfx start to matter.
export const sound = { enabled: true };

export function playSound(name: string): void {
  if (sound.enabled) void new Audio(`/audio/${name}.webm`).play().catch(() => {});
}
