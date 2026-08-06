/**
 * 한 장을 480ms 동안 띄웠다 지운다. `kind`는 크기만 가른다 — `cut`은 화면 전체(개입 컷인·신 일러),
 * `spark`는 `host` 가운데 한 장(카드 파티클)이다. 파티클 엔진도 풀도 만들지 않는다
 */
export async function playSprite(host: HTMLElement, source: string, kind: "cut" | "spark" = "cut"): Promise<void> {
  const image = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = source;
  if (!await loaded) return;
  const effect = document.createElement("span");
  effect.className = `fx ${kind}`;
  effect.append(image);
  host.append(effect);
  await effect.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).finished;
  effect.remove();
}
