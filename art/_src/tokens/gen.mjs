/**
 * 토큰 아이콘 13종 생성기(P-57). **GPT-image가 아니라 결정적 픽셀 비트맵이다** — 이 아이콘의
 * 요구가 「24px에서 읽히는 실루엣 · 무채색 단색(배지의 `--token-color`가 틴트)」이라 12×12
 * 픽셀 격자가 곧 스펙이고, 스크립트가 곧 원본이다. 다시 돌리면 같은 픽셀이 나온다.
 *
 * 출력: `art/_src/tokens/{token}.png` (192×192 = 12×12 격자 × 16, 흰색 + 알파).
 * 배포 변환은 각 md의 magick 한 줄이 한다 — **입·출력 경로를 같게 쓰지 않는다**(../README.md).
 *
 * 실행: `node art/_src/tokens/gen.mjs` (ImageMagick 필요)
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SIZE = 12;
const SCALE = 16;

/** 세 줄 손톱자국 — 평행 대각선 셋을 사각형이 자른다 */
const frenzy = Array.from({ length: SIZE }, (_, row) =>
  Array.from({ length: SIZE }, (_, col) => [row, row + 1, row + 4, row + 5, row + 8, row + 9].includes(col) ? "#" : ".").join(""));

/** 과녁 — 고리 + 십자 눈금 + 중심점 */
const mark = Array.from({ length: SIZE }, (_, row) =>
  Array.from({ length: SIZE }, (_, col) => {
    const dx = col - 5.5;
    const dy = row - 5.5;
    const dist = Math.hypot(dx, dy);
    const ring = dist >= 3.4 && dist <= 4.8;
    const center = Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2;
    const tick = (Math.abs(dx) < 1.2 && dist > 4.6) || (Math.abs(dy) < 1.2 && dist > 4.6);
    return ring || center || tick ? "#" : ".";
  }).join(""));

/** 네 갈래 별 — |dx·dy|가 작은 십자꼴 별 */
const crit = Array.from({ length: SIZE }, (_, row) =>
  Array.from({ length: SIZE }, (_, col) => {
    const dx = col - 5.5;
    const dy = row - 5.5;
    return Math.abs(dx * dy) <= 3.6 && Math.abs(dx) + Math.abs(dy) <= 7.5 ? "#" : ".";
  }).join(""));

const grids = {
  shock: [
    ".....#####..",
    "....#####...",
    "...#####....",
    "..#####.....",
    "..########..",
    "....######..",
    "...#####....",
    "..####......",
    ".####.......",
    ".###........",
    ".##.........",
    ".#..........",
  ],
  displace: [
    "............",
    "##....##....",
    ".##....##...",
    "..##....##..",
    "...##....##.",
    "....##....##",
    "...##....##.",
    "..##....##..",
    ".##....##...",
    "##....##....",
    "............",
    "............",
  ],
  soaked: [
    ".....##.....",
    ".....##.....",
    "....####....",
    "....####....",
    "...######...",
    "..########..",
    "..########..",
    ".##########.",
    ".##########.",
    "..########..",
    "...######...",
    "....####....",
  ],
  bulwark: [
    "##...##...##",
    "##...##...##",
    "############",
    "############",
    "############",
    "############",
    "####....####",
    "####....####",
    "####....####",
    "####....####",
    "............",
    "............",
  ],
  deflect: [
    "............",
    "............",
    "........####",
    ".........###",
    "##......####",
    ".##....##...",
    "..##..##....",
    "...####.....",
    "....##......",
    "............",
    "............",
    "............",
  ],
  thorns: [
    "............",
    "............",
    ".....#......",
    "....###.....",
    "#...###...#.",
    "##..###..##.",
    "###.###.###.",
    "###.###.###.",
    "############",
    "############",
    "............",
    "............",
  ],
  might: [
    ".....##.....",
    "....####....",
    "...######...",
    "..########..",
    ".##########.",
    "############",
    "....####....",
    "....####....",
    "....####....",
    "....####....",
    "############",
    "############",
  ],
  bleed: [
    "##..........",
    ".##.........",
    "..##........",
    "...##.......",
    "....##......",
    ".....##.....",
    "......##....",
    "............",
    "....####....",
    "...######...",
    "...######...",
    "....####....",
  ],
  frenzy,
  mark,
  crit,
  drain: [
    "############",
    "############",
    ".##......##.",
    "..##....##..",
    "...##..##...",
    "....####....",
    "....####....",
    "...##..##...",
    "..##....##..",
    ".##......##.",
    "############",
    "############",
  ],
  fog: [
    "............",
    "..########..",
    "..########..",
    "............",
    "#########...",
    "#########...",
    "............",
    "...#########",
    "...#########",
    "............",
    "............",
    "............",
  ],
};

const here = new URL(".", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "tokens-"));
for (const [token, grid] of Object.entries(grids)) {
  if (grid.length !== SIZE || grid.some((row) => row.length !== SIZE)) throw new Error(`${token}: 12×12가 아니다`);
  // PAM(RGBA)을 손으로 쓴다 — 의존 0. 픽셀 하나가 SCALE×SCALE 블록이라 안티에일리어싱이 없다
  const px = SIZE * SCALE;
  const body = Buffer.alloc(px * px * 4);
  for (let y = 0; y < px; y += 1) {
    for (let x = 0; x < px; x += 1) {
      const on = grid[Math.floor(y / SCALE)][Math.floor(x / SCALE)] === "#";
      body.set(on ? [255, 255, 255, 255] : [0, 0, 0, 0], (y * px + x) * 4);
    }
  }
  const header = `P7\nWIDTH ${px}\nHEIGHT ${px}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`;
  const pam = join(work, `${token}.pam`);
  writeFileSync(pam, Buffer.concat([Buffer.from(header), body]));
  execSync(`magick ${pam} ${join(here, `${token}.png`)}`);
  console.log(`${token}.png 192×192`);
}
rmSync(work, { recursive: true });
