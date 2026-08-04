export async function playSprite(host: HTMLElement, source: string): Promise<void> {
  const image = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = source;
  if (!await loaded) return;
  const effect = document.createElement("span");
  effect.className = "fx";
  effect.append(image);
  host.append(effect);
  await effect.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).finished;
  effect.remove();
}
