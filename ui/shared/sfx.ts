/**
 * 효과음. **없는 파일은 아예 요청하지 않는다** — 이름으로 URL을 지어 부르면 클릭마다 404가 하나씩
 * 쌓인다(콘솔·네트워크 로그가 그만큼 거짓말을 한다). 목록은
 * 번들러가 든다: 그림 에셋들과 같은 `import.meta.glob`이라 클립을 넣는 순간 저절로 울린다.
 *
 * ponytail: 겹침·끊김 없는 재생이 필요해지면 그때 AudioContext로 옮긴다.
 */
const clipFiles = import.meta.glob<string>(["../../audio/*.ogg", "../../audio/*.mp3", "../../audio/*.wav"], { eager: true, query: "?url", import: "default" });
const clips = Object.fromEntries(Object.entries(clipFiles).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, path.lastIndexOf(".")), url]));
const voiceFiles = import.meta.glob<string>(["../../audio/voice/*.mp3", "../../audio/voice/*.m4a"], { eager: true, query: "?url", import: "default" });
const voices = Object.fromEntries(Object.entries(voiceFiles).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, path.lastIndexOf(".")), url]));
const music = import.meta.glob<string>("../../audio/*.m4a", { eager: true, query: "?url", import: "default" });
const mainMusic = music["../../audio/Beneath_the_Iron_Altar.m4a"];
const endingMusic = music["../../audio/Beneath_the_Golden_Banner.m4a"];
let voice: HTMLAudioElement | undefined;

export const sound = { enabled: true };

export const musicForScreen = (screen: string): string | undefined =>
  screen === "result" ? endingMusic : screen === "intro" || screen === "setup" ? mainMusic : undefined;

export function playSound(name: string, volume = 1): void {
  const clip = clips[name];
  if (sound.enabled && clip) {
    const audio = new Audio(clip);
    audio.volume = volume;
    void audio.play().catch(() => {});
  }
}

export function voiceKey(god: string, text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${god}\0${text}`)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

export function playVoice(god: string, text: string): void {
  const clip = voices[voiceKey(god, text)];
  voice?.pause();
  if (!sound.enabled || !clip) return;
  voice ??= new Audio();
  voice.src = clip;
  void voice.play().catch(() => {});
}
