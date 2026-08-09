import { execFileSync } from "node:child_process";

const cell = 192;
const strips: Record<string, string[]> = {
  slash: ["slash_01", "slash_02", "slash_03", "slash_04"],
  spark: ["spark_01", "spark_02", "spark_03", "spark_04"],
  trace: ["trace_01", "trace_02", "trace_03", "trace_04"],
  muzzle: ["muzzle_01", "muzzle_02", "muzzle_03", "muzzle_04"],
  circle: ["circle_01", "circle_02", "circle_03", "circle_04"],
  window: ["window_01", "window_02", "window_03", "window_04"],
  star: ["star_01", "star_02", "star_03", "star_04"],
  glint: ["star_05", "star_06", "star_07", "star_08"],
  sigil: ["star_09", "symbol_01", "symbol_02", "flare_01"],
  twirl: ["twirl_01", "twirl_02", "twirl_03", "circle_05"],
  light: ["light_01", "light_02", "light_03", "muzzle_05"],
  magic: ["magic_01", "magic_02", "magic_03", "magic_04"],
  ember: ["spark_05", "spark_06", "spark_07", "magic_05"],
  flame: ["flame_01", "flame_02", "flame_03", "flame_04"],
  fire: ["flame_05", "flame_06", "fire_01", "fire_02"],
  smoke: ["smoke_01", "smoke_02", "smoke_03", "smoke_04"],
  haze: ["smoke_05", "smoke_06", "smoke_07", "smoke_08"],
  ash: ["smoke_09", "smoke_10", "dirt_01", "dirt_02"],
  scorch: ["dirt_03", "scorch_01", "scorch_02", "scorch_03"],
  rake: ["trace_05", "trace_06", "trace_07", "scratch_01"],
};

const frames = Object.values(strips).flat();
if (frames.length !== 80 || new Set(frames).size !== frames.length) throw new Error("particle frames must be 80 unique files");
for (const [name, sources] of Object.entries(strips)) {
  execFileSync("magick", [
    ...sources.map((source) => `art/particle/${source}.png`),
    "-resize", `${cell}x${cell}!`, "-background", "none", "+append",
    "-quality", "70", "-define", "webp:alpha-quality=95", `art/particle/${name}.webp`,
  ]);
}
console.log(`particles=${Object.keys(strips).length} cell=${cell}`);
