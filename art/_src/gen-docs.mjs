import { mkdirSync, writeFileSync } from "node:fs";

// 하드코딩된 홈 경로는 다른 기계에서 돈다는 보장이 없다 — 스크립트 위치에서 잡는다
const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");

// 전투는 좌우 대치다 — 적은 오른쪽에 서서 **왼쪽**을 본다. 방향이 어긋나면 둘이 등을 보고 싸운다 (§1 「방향」)
const FACE_LEFT =
  "side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored";

const SPRITE_STYLE = (what = "figure", pal = "cold gray-blue, bone white, ash brown", view = FACE_LEFT) =>
  `Style: pixel art sprite, single ${what} centered on a fully transparent background, ${view}, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, ${pal}, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.`;

// 지역 톤이 갈린다 — 저승은 회청색·뼈색, 지상은 금·청동에 대리석 흰색 (§1). 둘 다 저채도다
const palFor = (file) =>
  file.includes("surface")
    ? "dull gold, aged bronze, chalky marble white, storm gray"
    : "cold gray-blue, bone white, ash brown";

const BG_STYLE = (colors, region) =>
  `Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about ${colors} heavily desaturated colors, ${region}, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.`;

const UNDER_PAL = "cold gray-blue, ash gray, bone white, dead brown";
const SURFACE_PAL = "dull gold, aged bronze, chalky marble white, storm gray";

const CARD_TAIL = (hue) => `Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: ${hue}. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.`;

const ONE_HUE = (c) => `exactly one hue of light in the image, ${c}, covering about one quarter of the frame`;

// 변환은 알파·크로마키 정리와 구도 crop까지만 한다 — `-resize`·`-colors`를 원본에 걸지 않는다 (art/README.md).
// 입력은 항상 `art/_src/` 원본, 출력은 `art/`다. `in.png` 익명 입력이 원본 소실의 원인이었다
const CARD_CONVERT = (name) => `magick art/_src/cards/${name}.png -gravity center -crop 1365x1024+0+0 +repage \\
  -quality 88 art/cards/${name}.webp`;

const SPRITE_CONVERT = (name) =>
  `magick art/_src/${name}.png -alpha on -fuzz 35% -transparent '#00ff00' \\
  -trim +repage art/${name}.png`;

const BG_CONVERT = (name) => `magick art/_src/bg/${name}.png -gravity center -crop 1536x960+0+0 +repage \\
  art/bg/${name}.png`;

// 생성기는 「Transparent background」를 써도 **불투명 PNG를 낸다** — 실제로 open·block 원본이 alpha=Undefined로 나왔다.
// 그래서 알파는 크로마키로 만든다. 마젠타를 쓰는 이유는 `-fx` 조건이 「r·b 높고 g 낮음」이라
// `block`의 탁한 붉은 테두리(#9b2226 계열, b가 낮다)를 안 먹기 때문이다. 초록 키는 창백한 빛을 갉아먹는다
const OVERLAY_CONVERT = (name) => `magick art/_src/fx/${name}.png -alpha set -channel A \\
  -fx '((r>0.12)&&(b>0.12)&&(r>g*1.25)&&(b>g*1.25))?0:a' +channel \\
  -gravity center -crop 1536x960+0+0 +repage \\
  -define webp:lossless=true art/fx/${name}.webp`;

const OVERLAY_KEY = `The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect.`;

const HERO_CONVERT = (name) => `magick art/_src/hero/${name}.png -gravity center -crop 1536x960+0+0 +repage \\
  -quality 90 art/hero/${name}.webp`;

// 「32×32 PNG 알파, 화면 96×96(3배).」 같은 앞머리가 파일 크기 지시로 읽혀 원본이 깎였다.
// 격자 숫자는 화면 참고값으로만 남기고 파일 쪽은 원본 유지로 못박는다
const safeSpec = (spec) =>
  spec.replace(
    /^\*{0,2}(\d+)×(\d+)\*{0,2} PNG 알파, 화면 (\d+)×(\d+)\(3배\)\./,
    (_, w, h, sw, sh) =>
      `PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.\n\n**화면** ${sw}×${sh}. CSS가 ${w}×${h} 격자를 3배 확대한 크기다(\`image-rendering: pixelated\`) — **구도용 참고값이고 파일 크기 지시가 아니다.**`,
  );

const LIGHT_FIX = "the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame";

// 배경 4장이 세로·정사각으로 나왔다 — 「가로로 뽑는다」가 **생성 지시에만** 있고 프롬프트 본문엔 없었다.
// `open.webp`는 프롬프트 안에 이 문장이 있어서 가로를 지켰다. 그 문장을 배경·일러에도 박는다
const LANDSCAPE =
  "Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.";

const docs = [];
const add = (d) => docs.push(d);

// ─────────────────────────────────────────── 적 11종
const enemy = (file, title, spec, size, subject, notes, gen = "1024×1536") =>
  add({
    path: `sprites/${file}.md`,
    title: `\`${file}.png\` — ${title}`,
    ref: "§1",
    spec: safeSpec(spec),
    gen,
    convert: SPRITE_CONVERT(`sprites/${file}`),
    convertNote:
      "**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.",
    prompt: `${subject}\n\n${SPRITE_STYLE("figure", palFor(file))}`,
    notes,
  });

enemy(
  "enemy_under_brute",
  "시체먹는 에우리노모스",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 brute HP40 · 16딜 분노. **입이 실루엣의 중심이다.**",
  [32, 32],
  `Eurynomos, the corpse-eating demon of the Underworld who strips the dead down to bone. A hunched gaunt ghoul with flesh the blue-grey of a carrion fly, filling the whole canvas edge to edge. Its open mouth is the centre of the silhouette, jaw distended far too wide, and it is throwing its whole body FORWARD to bite. Long thin arms trailing behind, distended belly, teeth. A few pixels of saturated blood red at the mouth only.`,
  [
    "**움직이는 것을 먹는다** — 32px를 꽉 채우는 유일한 일반 적이다. 몸을 앞으로 던지는 자세",
    "핏빛 3픽셀은 입가에만. 그 몇 픽셀이 유일한 고채도 색이라 시선이 정확히 거기로 간다",
    "살빛이 파리처럼 푸르다는 원전 속성이 팔레트를 정한다 — 다른 저승 적과 색으로도 갈린다",
  ],
);

enemy(
  "enemy_under_swarm",
  "스키아이 떼 (잡몹)",
  "**24×24** PNG 알파, 화면 72×72(3배). idle 2~4프레임 스트립.\n\n역할 swarm HP25 · 3딜. **공격이 3딜뿐인 이유가 그림에 있다** — 죽이려는 게 아니라 붙잡는 것이다.",
  [24, 24],
  `The Skiai, the nameless shades of the Underworld dead, rendered as ONE clotted mass of ash and maggots rather than a clear body. No face, no recognisable limbs beyond the arms: thin arms reach UPWARD out of the mass from below, grasping, as if trying to be pulled along with someone climbing past. Formless, crumbling, held together by nothing.`,
  [
    "**같이 나가려고 매달린다.** 팔이 아래에서 위로 뻗는 게 이 스프라이트의 전부다",
    "24×24라 세트에서 유일하게 작다. HP25에 여러 마리 배치되므로 실루엣이 뭉쳐도 된다",
    "형체가 없는 게 목적이다 — 얼굴이나 사지를 그리면 다른 적과 구별이 흐려진다",
  ],
);

enemy(
  "enemy_under_guardian",
  "스파르토이 방패병",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 guardian HP30 · 방벽 부여. **방패가 실루엣의 절반이다.**",
  [32, 32],
  `A Spartoi, a warrior grown from a sown dragon's tooth, now only a skeleton still holding its post. It wears the same panoply as the player's soldier but over bare bone, ribs visible behind the shield. A large round bronze-rimmed shield takes up fully half the silhouette, planted and braced; the spear is secondary and held low. It stands and blocks, nothing more. Only an order remains of it.`,
  [
    "**`enemy_surface_guardian`(청동 탈로스 파편)과 골격을 공유한다.** 뼈색 → 청동색 팔레트 스왑 + 갈비뼈 자리에 이음새 몇 픽셀. 방패 각도와 idle 흔들림은 그대로 쓴다 — **이 스프라이트를 먼저 확정해야 그쪽이 리스킨으로 끝난다**",
    "같은 골격을 쓴 둘은 한 화면에 뜨지 않는다 — `groups`가 `with` 목록을 같은 region 안에서만 묶는다",
    "**병사의 미래이기도 하다.** 같은 무구를 뼈로 걸치고 있는 게 그 장치다",
  ],
);

enemy(
  "enemy_under_zealot",
  "마르시아스의 고행자",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 zealot HP35 · 8딜 앙심. **앙심 1이 벗겨진 가죽 그 자체다.**",
  [32, 32],
  `A follower of Marsyas, the satyr flayed alive by Apollo. A flayed body, all muscle and exposed sinew, wearing its OWN removed skin draped over its shoulders like a cloak. Goat legs. It stands in a posture of offering, arms slightly open, welcoming the punishment. It has come to love the pain. Blood red used on only two or three pixels at the shoulders where the skin hangs.`,
  [
    "**`enemy_surface_zealot`(마이나스)과 골격을 공유한다.** 가죽 벗겨진 몸 ↔ 맨몸. 이쪽을 먼저 그린다",
    "**고어의 정점이자 32px에서 실루엣만으로 되는 것.** 내장을 그리려 하면 얼룩이 된다 — 훼손된 실루엣 + 핏빛 2~3픽셀이 한계다",
    "도망은 그에게 신을 향한 모욕이다 — 자세가 공격적이지 않고 「제물을 바치는」 쪽이어야 한다",
  ],
);

enemy(
  "enemy_surface_pressure",
  "켄타우로스 습격자",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 pressure HP40 · 8/8/16. **돌진 셋이 그 세 수치다.**",
  [32, 32],
  `A centaur raider, from the drunken tribe that stormed a wedding feast. Four-legged horse body with a heavy human torso above it, front hooves already coming off the ground at the start of a charge, driving DOWNWARD and to the LEFT at the soldier as if herding prey ahead of it. Crude club or torn banner, no proper armour, matted hide. Dull gold and aged bronze rather than the grey-blue of the Underworld.`,
  [
    "**저승 pressure(복수의 에리니스)와 골격을 공유하지 않는다.** 날개 여인 ↔ 4족으로 실루엣이 갈리는 게 목적이라 공유를 포기한 유일한 쌍이다",
    "pressure는 두 지역 모두에서 단독 등장하는 첫 대면 상대라, **저승과 지상이 다른 곳이라는 인상을 이 둘이 만든다.** 여기는 아낄 자리가 아니다",
    "지상의 적은 **되돌려보내려 한다** — 위에서 내려다보고 밀어낸다. 신들이 풀어놓은 몰이꾼이다",
  ],
);

enemy(
  "enemy_surface_attrition",
  "사자 가죽의 파수병",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 attrition HP40 · 경화 8. **경화 8이 그 가죽이다.**",
  [32, 32],
  `A heavy infantry guard wearing the pelt of the Nemean lion, whose hide no weapon can pierce. The lion's head is worn as a hood over the helmet, jaws framing the face; the pelt hangs down over the body like plate. It only stands and blocks the road, a rigid vertical silhouette, arms hanging heavy, spear held upright and unused. Dull gold and aged bronze, chalky marble white.`,
  [
    "**`enemy_under_attrition`(레테의 익사자)의 리스킨이다.** 같은 캔버스·실루엣·포즈·프레임 타이밍을 쓰고 불어터진 살 → 사자 가죽으로 팔레트와 장비 몇 픽셀만 바꾼다. 익사자를 먼저 확정한다",
    "**길을 막고 서 있기만 한다** — 공격 자세를 주면 켄타우로스와 역할이 흐려진다",
    "지역 톤이 갈린다: 저승은 회청색·뼈색, 지상은 금·청동에 대리석 흰색. 둘 다 저채도다",
  ],
);

enemy(
  "enemy_surface_applier",
  "델포이의 무녀",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 applier HP40 · 침수·감전 부여. **직접 때리지 않고 표식만 남긴다.**",
  [32, 32],
  `The Pythia of Delphi, who breathes the vapour rising from the earth and vomits prophecy. A standing robed woman, both hands raised open at her sides, head tilted back with eyes rolled fully white, vapour pouring out of her open mouth. She does not strike; she is reporting the soldier's position to the gods. Heavy layered robe hiding the feet, tripod stool shape at her back. Chalky marble white and dull gold.`,
  [
    "**병사의 위치를 신들에게 알린다.** 그래서 무기가 없고 자세가 「부르는」 쪽이다 — 침수·감전 부여가 그 그림이다",
    "들린 두 손과 입에서 나오는 증기가 32px에서 이 적을 특정하는 두 요소다",
    "골격 공유 대상이 없다 — 저승에는 applier가 없다",
  ],
);

enemy(
  "enemy_surface_support",
  "타락한 니케",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 support HP35 · 아군 힐·광란. **유일한 비행 실루엣이다.**",
  [32, 32],
  `Nike, goddess of victory, gone rotten. A winged female figure hovering clear of the ground, the ONLY airborne silhouette in the set, gold leaf flaking off her skin in patches, wings half-decayed with feathers missing. Her body is turned LEFT toward the soldier but the battered trumpet is raised back over her shoulder to the RIGHT, sounding victory for her own side only, never for him. Refuses to acknowledge the soldier's victory. Dull gold, aged bronze, chalky white.`,
  [
    "**유일한 비행 실루엣이다.** 발이 땅에 닿으면 그 값이 사라진다 — 아래에 여백을 남긴다",
    "자기 편에만 승리를 나눠 준다 — 힐·광란 부여가 그 그림이다. 나팔이 병사를 향하지 않아야 한다",
    "금박이 벗겨진 몸이 「타락한」의 그림이다. 새 금색을 칠하면 지상 파수병들과 구별이 흐려진다",
  ],
);

enemy(
  "enemy_surface_guardian",
  "청동 탈로스 파편",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 guardian HP35 · 방벽 부여. **부서진 뒤에도 문을 지킨다.**",
  [32, 32],
  `A fragment of Talos, the bronze automaton that guarded Crete, still standing guard after being broken. A bronze warrior body with visible seams and rivets where the plates join, one limb clearly a piece of something much larger so the proportions are wrong. A large bronze shield takes up half the silhouette, planted and braced. Dead metal, no eyes, no expression. Aged bronze and verdigris, chalky marble white.`,
  [
    "**`enemy_under_guardian`(스파르토이 방패병)의 리스킨이다.** 뼈색 → 청동색 팔레트 스왑 + 갈비뼈 자리에 이음새 몇 픽셀. 방패 각도와 idle 흔들림을 그대로 쓴다",
    "부서진 큰 것의 일부라 **비율이 어긋나 있다** — 그게 스파르토이와 실루엣을 조금 갈라 주는 유일한 장치다",
    "같은 골격을 쓴 둘은 한 화면에 뜨지 않는다 — 그게 공유가 안전한 근거다",
  ],
);

enemy(
  "enemy_surface_zealot",
  "마이나스",
  "32×32 PNG 알파, 화면 96×96(3배). idle 2~4프레임 스트립.\n\n역할 zealot HP35 · 10딜. **신이 시키지 않아도 한다.**",
  [32, 32],
  `A Maenad, a follower of Dionysus who tears living things apart with bare hands. A bare human body, no armour and almost no clothing, hair thrown forward over the face, carrying a single thyrsus staff. Head tilted at a wrong angle, mid-frenzy, hands open and reaching. Human imitation of the gods' caprice. Saturated blood red on only three pixels: the hands and the mouth.`,
  [
    "**`enemy_under_zealot`(마르시아스의 고행자)의 리스킨이다.** 가죽 벗겨진 몸 → 맨몸, 걸친 가죽을 지우고 티르소스 하나를 준다",
    "핏빛 3픽셀은 손과 입에만. 그 위치가 「맨손으로 찢는다」를 말한다",
    "**다섯 신의 변덕을 인간이 흉내낸 모습이다** — 신이 시키지 않아도 한다는 게 지상 zealot의 동기다",
  ],
);

enemy(
  "enemy_surface_boss",
  "잠들지 않는 아르고스 (12층 보스)",
  "**48×48** PNG 알파, 화면 144×144(3배). idle 2~4프레임 + **attack 2프레임**(보스 2종만 받는다).\n\n역할 boss HP190 · 24딜 · 결계 2. **`ward` 2가 「잠들지 않음」 그 자체다.** 아트는 수치를 그대로 받는다.",
  [48, 48],
  `Argos Panoptes, the hundred-eyed watchman of Hera who never sleeps, set before the gate to the surface by Olympos. A TALL vertical humanoid giant, much taller than wide, standing upright and looking DOWN AND TO THE LEFT at the soldier. Its entire body, torso, arms and shoulders, is studded with eyes rendered as dense one- and two-pixel dots, packed close so the density itself reads as a hundred rather than any countable number. Every eye is open. Bronze-toned skin, a staff held upright, no helmet.`,
  [
    "**눈 백 개는 세지 말고 밀도로 그린다.** 정확한 수를 맞추려 하면 몸 형태가 사라진다",
    "**세로로 높은 실루엣이 목적이다.** 케르베로스가 가로로 넓으니 두 보스가 반대로 갈려야 한다",
    "올림포스가 지상의 문 앞에 세웠다 — 「신들이 제멋대로 막는다」의 결말이라 위에서 내려다보는 자세다",
  ],
  "1024×1536",
);

// ─────────────────────────────────────────── 진노 신 5종 (§1.5)
// 두 톤이 한 스프라이트에서 만나는 유일한 자리다 — 몸은 DD2 저채도로 두고 신 색을 2~3픽셀만.
// 그리고 신은 훼손되지 않는다: 고어가 적 전부에 걸린 규칙이라 그것 하나로 종류가 갈린다
const GOD_STYLE = (accent) =>
  `The body is UNDAMAGED and flawless: no wounds, no missing limbs, no rot, no blood, no gore, nothing torn. Every other figure in this set is mutilated; this one is not.

Style: pixel art sprite, single figure centered on a fully transparent background, ${FACE_LEFT}, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, aged bronze, chalky marble white, with a single high-saturation accent ${accent} on no more than three pixels and nowhere else in the image. Darkest Dungeon style grim dark-fantasy, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no bloom, no god rays, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.`;

const god = (file, ko, passive, accent, whereKo, subject, notes) =>
  add({
    path: `sprites/${file}.md`,
    title: `\`${file}.png\` — ${ko} (진노)`,
    ref: "§1.5",
    // 다섯 다 한 장도 없다 — `DISK_STATUS.sprites`(일부만 생성됨)를 쓰면 있는 것처럼 읽힌다
    status: "미생성",
    spec: safeSpec(
      `32×32 PNG 알파, 화면 96×96(3배). **idle 2프레임**(진노는 20조우에 한 번이다).\n\n패시브 ${passive}. **아트는 P-30 §2가 정한 것을 그대로 받는다.** 신 색은 **${whereKo}**에만 2~3픽셀.`,
    ),
    gen: "1024×1536",
    convert: SPRITE_CONVERT(`sprites/${file}`),
    convertNote:
      "**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다.\n\n**위를 자르는 것은 여기서 한다.** 프레임을 넘기는 구도는 생성으로 잘 안 나오므로 `-trim` 뒤에 상단을 잘라 실루엣이 테두리를 넘게 만든다 — 크기를 늘리지 않고 규모를 내는 장치다(§1.5).",
    prompt: `${subject}\n\n${GOD_STYLE(accent)}`,
    notes,
  });

god(
  "enemy_god_zeus",
  "제우스",
  "`ramp` 고조",
  "an antique gold #d4a017",
  "번개창 끝",
  `Zeus himself joined to the battle line as an enemy, wrathful. A standing bearded figure with one arm raised straight ABOVE the head gripping a thrown lightning javelin, the only upward-reaching silhouette in the set. Heavy draped himation over one shoulder, bare chest, no helmet, no shield. Looking down and to the LEFT at the soldier while the arm stays up: the blow has not landed yet and grows every turn. The raised hand and the javelin tip are cropped by the top edge of the frame, the figure does not fit inside it.`,
  [
    "**위로 뻗는 실루엣은 이 스프라이트만이다.** 팔을 내리면 `ramp`(매 턴 세진다)가 그림에서 사라진다",
    "신 색 2~3픽셀은 **번개창 끝**에만. 몸이나 옷을 금색으로 칠하면 지상 파수병들과 섞인다",
    "머리와 든 손이 프레임 위로 잘린다 — 48×48로 키우지 않고 규모를 내는 방법이다",
  ],
);

god(
  "enemy_god_poseidon",
  "포세이돈",
  "`ward` 결계",
  "a deep desaturated teal #2e7d8f",
  "물벽의 윗선",
  `Poseidon himself joined to the battle line as an enemy, wrathful. A standing bearded figure planting a trident VERTICALLY into the ground with both hands, and in front of him on his LEFT a raised standing wall of water, flat-topped and solid like masonry rather than a splash. The wall takes up half of the silhouette and hides his forward leg: nothing reaches him. Heavy soaked robe, bare chest, no helmet.`,
  [
    "**앞이 막혀 있는 것이 `ward`다.** 물벽이 실루엣의 절반을 먹어야 아르고스의 세로 실루엣과 갈린다",
    "물벽은 튀는 물이 아니라 **선 벽**이다 — 물보라로 그리면 32px에서 형태가 사라진다",
    "신 색 2~3픽셀은 **물벽의 윗선**에만",
  ],
);

god(
  "enemy_god_athena",
  "아테나",
  "`guard` 보호",
  "a dull olive bronze #7a8b5c",
  "아이기스 테두리",
  `Athena herself joined to the battle line as an enemy, wrathful. A standing armoured female figure holding a large ROUND aegis shield out to her LEFT, its face presented flat toward the soldier, spear lowered and held level at her hip rather than raised. Crested Corinthian helmet with the face in shadow behind it. Braced, blocking, not attacking. The helmet crest is cropped by the top edge of the frame.`,
  [
    "**방패는 원형이다.** 스파르토이 방패병과 탈로스 파편이 사각 방패를 쓴다 — 원형이 아테나의 자리고, 그것 하나로 셋이 갈린다",
    "창을 들어올리면 아레스와 자세가 겹친다. 낮춘 창이 `guard`(막는다)의 그림이다",
    "신 색 2~3픽셀은 **아이기스 테두리**에만",
  ],
);

god(
  "enemy_god_ares",
  "아레스",
  "`spite` 앙심",
  "a dark blood red #9b2226",
  "창끝",
  `Ares himself joined to the battle line as an enemy, wrathful. A standing armoured figure leaning FORWARD AND TO THE LEFT off balance, weight already committed, carrying a single spear and NO shield at all. Full helmet with only the eye slits visible, no face. The whole silhouette tilts forward at a clear angle: he takes the hit to return it. The helmet is cropped by the top edge of the frame.`,
  [
    "**색으로 구별되지 않는 유일한 신이다.** 아레스의 `#9b2226`이 이미 모든 스프라이트의 핏빛 강조색이라, 앞으로 기운 각도와 **방패 없음**이 그 몫을 진다",
    "밝은 주홍으로 도망치지 않는다 — §3의 신 색 정본이 흔들리면 카드 20장이 같이 어긋난다",
    "앞으로 기운 각도가 `spite`(맞으면 되돌려준다)의 그림이다. 똑바로 서면 아테나와 실루엣이 겹친다",
  ],
);

god(
  "enemy_god_artemis",
  "아르테미스",
  "`shell` 경화",
  "a pale muted amethyst #8e7ca6",
  "당긴 화살촉",
  `Artemis herself joined to the battle line as an enemy, wrathful. A standing female figure with a bow drawn full and aimed LEFT, arrow at the cheek and its head pointing left, weight shifted back onto the RIGHT foot as if stepping away from what she is aiming at. Short hunting chiton, bare legs, no armour, no helmet, hair tied back. The only figure in the set that keeps its distance instead of closing in.`,
  [
    "**뒤로 물러선 원거리 자세는 세트에 없다.** 다가서게 그리면 다른 넷과 방향이 겹친다",
    "갑주를 입히면 `shell`이 방어구로 읽힌다 — 경화는 맞는 값을 깎는 것이고 그건 신의 몸이지 장비가 아니다",
    "신 색 2~3픽셀은 **당긴 화살촉**에만",
  ],
);

// ─────────────────────────────────────────── 배경 5장
const bg = (file, title, where, subject, pal, notes) =>
  add({
    path: `bg/${file}.md`,
    title: `\`${file}.png\` — ${title}`,
    ref: "§2",
    spec: `PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**\n\n**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(\`image-rendering: pixelated\`) — **구도용 참고값이고 파일 크기 지시가 아니다.**\n\n**어디에** ${where}`,
    gen: "1536×1024 — **가로로 뽑는다**",
    convert: BG_CONVERT(file),
    convertNote:
      "**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.\n\n**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.\n\n**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.",
    prompt: `${subject}\n\n${LANDSCAPE}\n\n${BG_STYLE(24, pal)}`,
    notes,
  });

// 디스크에 사이드카가 있는데 생성기에는 없었다 — 정본이 안 덮으니 다음 재생성이 이 한 장만 건너뛴다.
// 그림 자체는 1536×1024 가로로 이미 맞다(§2 1차 세트) — 나머지 다섯 장의 기준이 되는 장이다
bg(
  "under-combat",
  "오르는 길 (저승 1~5층 전투 배경)",
  "저승 1~5층 전투 · **1차 세트로 픽셀 배율·팔레트·고어 수준이 여기서 굳었다**",
  `Pixel art environment plate for a grim Greek-mythology roguelike. Wide side-view of the lowest depths of the Underworld: a broken, collapsed stone stairway and cliff face climbing upward out of frame, ledges of cracked black rock. Lower right, the black river Styx pooling between the rocks. Along the left and right edges, the corpses of those who failed the climb, half-fused into the stone, losing their shape, arms submerged in the river, a body hanging from a hook.

Light: the upper edge of the image holds ONE single thin faint pale line of light, the only light source, very dim and narrow; everything below fades into near-black darkness. ${LIGHT_FIX}

Composition: the entire central area must stay dark, empty and quiet with no detail and no bright contrast, all detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure.`,
  UNDER_PAL,
  [
    "**이 한 장이 나머지 다섯 장의 기준이다.** 1차 세트로 픽셀 배율 3배·팔레트·고어 수준이 여기서 굳었으니 다시 뽑을 때 이 장에 맞춘다",
    "**위쪽 빛 한 줄이 §0.4의 상승 전체를 짊어진다.** 1층이 밑바닥이고 12층이 끝이라 여기가 가장 어둡고 빛이 가장 가늘다 — 밝게 그리면 여섯 장의 기울기가 무너진다",
    "1~5층 다섯 층이 이 한 장을 쓴다. 화면에 가장 오래 뜨는 배경이라 중앙이 조용해야 패널 글자가 산다",
  ],
);

bg(
  "under-boss",
  "저승의 문 (6층 케르베로스)",
  "6층 보스전",
  `Pixel art environment plate for a grim Greek-mythology roguelike. The gate of the Underworld seen from the INSIDE: a huge closed bronze double door filling the upper middle distance, barred shut against the viewer. The floor before it is a bone yard of everyone who failed to pass, skulls and ribs heaped up the walls. Deep gouges and claw-marks scored into the bronze. Something hangs from a hook to one side.

Light: a thin seam of pale light LEAKS through the crack between the two doors and along their top edge, close enough to reach and still blocked. That seam is the only light in the frame. ${LIGHT_FIX}

Composition: the entire central area must stay dark, quiet and low-contrast with no fine detail, all detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no dog, no player figure.`,
  UNDER_PAL,
  [
    "**빛이 문틈으로 새는 게 이 배경의 전부다.** 닿을 만큼 가까운데 막혀 있다 — 6층이 저승의 문이고 12층이 지상의 문이라는 두 문 구조의 앞쪽이다",
    "케르베로스를 배경에 그리지 않는다 — 스프라이트가 그 자리에 선다",
    "**중앙 1040px은 패널이 86% 덮는다.** 좋은 디테일을 중앙에 두면 안 보이고, 대비가 강하면 패널 글자를 잡아먹는다",
  ],
);

bg(
  "surface-combat",
  "무너진 올림포스 신전 (지상 7~11층)",
  "지상 7~11층 전투",
  `Pixel art environment plate for a grim Greek-mythology roguelike. A ruined temple of Olympos on open ground: toppled marble columns lying across the frame, a collapsed portico, votive offerings left where they fell and rotted in place. Dried blood on the marble, smashed devotional statues. This is the first open sky the soldier has ever seen.

Light: the ENTIRE upper portion of the frame is sky, pale and overcast, far brighter than any Underworld plate. On the far horizon, small and centred low, stands ANOTHER GATE, a distinct silhouette of a doorway of light, foreshadowing floor 12. ${LIGHT_FIX}

Composition: the central area must stay darker, quieter and lower-contrast than the edges so panel text stays readable over it; all fine detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure.`,
  SURFACE_PAL,
  [
    "**지평 저 끝의 또 하나의 문이 12층 예고다.** 작게, 중앙 아래쪽에 — 크게 그리면 `surface-boss`와 겹친다",
    "여섯 장이 한 줄의 상승을 그린다. 여기서 위쪽 빛이 처음으로 **하늘 전체**가 된다",
    "지상 톤은 금·청동에 대리석 흰색이다. 저채도는 유지한다 — 채도를 올리면 카드가 안 튄다",
  ],
);

bg(
  "surface-boss",
  "지상의 문 (12층 아르고스)",
  "12층 보스전",
  `Pixel art environment plate for a grim Greek-mythology roguelike. The gate to the surface world, raised by Olympos: a towering doorway made of light itself, its frame carved marble and bronze, standing closed at the top of a short flight of steps. Heaped at the foot of the steps are the remains of everyone who reached this far before, armour and bones and offerings; the soldier is not the first.

Light: THE GATE ITSELF IS THE LIGHT, the brightest thing in the whole six-plate set, the point every previous plate's thin seam of light was pointing toward. Its glow stays contained to the gate and the steps and does not wash across the frame. ${LIGHT_FIX}

Composition: the gate sits in the upper middle but its brightest area must stay narrow so panel text remains readable; the central area stays low-contrast, all detail and all remains are pushed to the left and right thirds and the bottom edge. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no guardian figure, no player figure.`,
  SURFACE_PAL,
  [
    "**여섯 장의 빛이 여기로 수렴한다.** 이 한 장이 밝지 않으면 앞의 다섯 장이 그린 상승이 결말을 못 받는다",
    "아르고스를 배경에 그리지 않는다 — 스프라이트가 문 앞에 선다",
    "**빛을 넓게 퍼뜨리면 패널 글자를 잡아먹는다.** 문 자체에만 가두고 좌우로 흘리지 않는다",
  ],
);

bg(
  "map-under",
  "저승 경로 선택 배경",
  "`MapScreen` 저승 구간 (1~6층)",
  `Pixel art environment plate: a WIDE cutaway of a cliff wall deep inside the Underworld, seen as a map backdrop. The rock face spans the entire width of the frame, its lower band sunk in pure darkness, and THREE separate broken paths thread up through the stone side by side, clearly three distinct routes with gaps of bare rock between them. Remains of those who took the wrong path are lodged in the rock here and there. The climb is read as three routes across a wide wall, not as one tall shaft.

Light: the frame gets steadily brighter toward the TOP, ending in a narrow seam of light along the upper edge where the rock almost closes, the gate crack far above. ${LIGHT_FIX}

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.`,
  UNDER_PAL,
  [
    "P-27에서 지도가 **지역당 6층 × 3갈래 격자**가 됐다. 세 갈래가 갈라진 길로 보여야 한다",
    "`MapPanel`이 위에서 아래로 6층 → 1층을 깐다 — 「오르는 방향과 화면 방향이 같다」. **밝기 기울기가 화면 위쪽으로 간다**",
    "**노드 아이콘·연결선·마커를 그리지 않는다.** 아이콘은 P-33 벡터, 연결선은 CSS 의사요소, 마커는 `art/ui/marker.png`다",
    "결과 화면은 `.map-columns`가 저승·지상 두 장을 **나란히** 놓는다 — `map-surface`와 톤이 이어져야 한다",
  ],
);

bg(
  "map-surface",
  "지상 경로 선택 배경",
  "`MapScreen` 지상 구간 (7~12층)",
  `Pixel art environment plate: a WIDE view of a ruined mountain road above ground, seen as a map backdrop. Broken temple steps and switchback paths cut back and forth ACROSS the full width of the frame as they climb, three separate routes distinguishable through the fallen masonry. Toppled columns and abandoned offerings mark the levels already passed. The switchbacks run left and right across a wide frame — that is what keeps the climb inside a landscape shape.

Light: the frame gets steadily brighter toward the TOP, and near the top edge, small and backlit, stands the silhouette of the gate to the surface. ${LIGHT_FIX}

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.`,
  SURFACE_PAL,
  [
    "`map-under`와 **한 화면에 나란히 축소되어 들어간다**(`.map-columns`). 두 장의 톤과 밝기 기울기가 이어져야 한다",
    "맨 위의 지상의 문 실루엣이 `surface-boss`와 같은 문이다 — 형태를 맞춘다",
    "**갈래 이름 아이콘을 그리지 않는다** — `laneName`이 「왼쪽·가운데·오른쪽」이고 위치가 곧 이름이다",
  ],
);

// ─────────────────────────────────────────── 프롭 13개
const prop = (file, title, size, subject, notes, hand = false) => {
  const px = size;
  add({
    path: `props/${file}.md`,
    title: `\`${file}.png\` — ${title}`,
    ref: "§2 프롭",
    spec: `PNG 알파, ${hand ? `**직접 찍는 ${px}×${px}이다** — 생성물이 아니라 이 크기가 원본이다.` : "**생성 원본 해상도 유지 — 축소하지 않는다.**"}\n\n**화면** ${px * 3}px. CSS가 ${px}×${px} 격자를 3배 확대한 크기다 — ${hand ? "직접 찍는 것이라 격자 크기가 곧 파일 크기다." : "**구도용 참고값이고 파일 크기 지시가 아니다.**"} 배경과 \`.shell\` 사이 레이어(\`z-index: -1\`).\n\n**정지 이미지 1장이다. 애니메이션 프레임을 그리지 않는다** — 움직임은 CSS \`transform\` 루프다.`,
    gen: hand ? null : "1024×1536",
    convert: hand ? null : SPRITE_CONVERT(`props/${file}`),
    convertNote: hand
      ? null
      : "**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.",
    // 프롭은 사물이라 좌우가 없다 — `FACE_LEFT`를 태우면 재·물방울에 「왼쪽을 본다」가 붙는다
    prompt: hand ? null : `${subject}\n\n${SPRITE_STYLE("object", palFor(file), "side-on three-quarter view")}`,
    handNote: hand ? subject : null,
    notes,
  });
};

const FLOW_NOTE =
  "**움직이는 방향이 스토리다.** 저승 프롭은 **아래로** 흐르고 지상 프롭은 **위로** 뜬다 — 병사만 위로 간다. 같은 프롭 한 장으로 CSS 방향만 뒤집으면 되므로 에셋이 늘지 않는다";

prop(
  "under_wisp",
  "망령 불꽃 (푸른 도깨비불)",
  8,
  `A single small will-o'-the-wisp flame, one isolated cold blue-white ember hanging in empty space, a pale core with a darker blue edge and nothing else. No candle, no torch, no scenery, no smoke.`,
  [
    "**저채도 규칙의 예외가 아니다** — 청백색이되 형광은 아니다. 화면에 여러 개가 동시에 뜨므로 밝으면 배경을 죽인다",
    "화면에서는 24px로 뜬다 — 중심과 테두리 두 톤이면 충분하고, 그 이상 디테일은 그 크기에서 사라진다",
    FLOW_NOTE,
  ],
);

prop(
  "under_ash",
  "재·먼지 낙하",
  8,
  `A sparse cluster of falling ash and dust, only a few irregular pale grey flecks drifting downward, isolated with generous empty space between them. No smoke cloud, no flame, no scenery.`,
  [
    "가장 많이 뜨는 프롭이다 — 화려하면 안 된다. 회색 점 몇 개가 정답이다",
    "화면에서는 24px로 뜬다 — 점이 많으면 그 크기에서 얼룩 하나로 뭉친다",
    FLOW_NOTE,
  ],
);

prop(
  "under_droplet",
  "스틱스 물방울",
  8,
  `A single falling droplet of black river water, one teardrop shape narrower at the top and wider at the bottom, dark blue-grey with one small highlight at its upper edge, isolated in empty space. No splash, no ripple, no water surface, no scenery.`,
  [
    "강물에서 튀어 아래로 흐른다",
    "화면에서는 24px로 뜬다 — 눈물 모양과 위쪽 하이라이트 하나가 그 크기에서 남는 전부다",
    FLOW_NOTE,
  ],
);

prop(
  "under_flies",
  "파리 떼 (에우리노모스 주변)",
  8,
  `A small swarm of carrion flies, four or five tiny black specks scattered at IRREGULAR spacing in empty space, no two the same distance apart. Nothing else in the frame. No insect anatomy, no wings drawn, no scenery, no corpse.`,
  [
    "**파리 떼와 매달린 사슬이 저승의 고어를 「움직이는 것」으로 만든다** — 정지 배경만으로는 안 나오는 값이다",
    "에우리노모스가 시체를 먹는 악령이라는 설정에 붙는다 — 그 적이 뜨는 조우에서 밀도를 올린다",
    "**점을 규칙적으로 놓으면 패턴으로 읽혀 벌레가 아니게 된다.** 간격이 다 달라야 한다",
  ],
);

prop(
  "under_river_glint",
  "강물 반짝임",
  16,
  `A single narrow horizontal glint of light on the surface of black water, a thin broken streak with a slightly brighter core, nothing else in the frame. No wave, no splash, no reflection of any object.`,
  ["스틱스 수면에 깔린다. 세로로 길면 물이 아니라 빛줄기로 읽힌다", FLOW_NOTE],
);

prop(
  "under_tartarus_glow",
  "타르타로스 붉은 균열 빛",
  32,
  `A jagged crack in black rock with a dull red glow coming up out of it from below, the light contained inside the crack and its immediate edges. The only saturated colour in the Underworld palette. No flames, no embers, no lava flow, no sparks.`,
  [
    "**저승에서 유일하게 채도가 높은 프롭이다.** 여러 개 배치하면 그 값이 사라진다 — 화면에 하나둘",
    "타르타로스는 아래다 — 빛이 **아래에서** 올라온다. 위쪽 빛과 방향이 반대라 상승 구조를 거든다",
  ],
);

prop(
  "surface_storm_cloud",
  "폭풍 구름",
  32,
  `A single dense clump of storm cloud with a flat dark underside and a slightly lit upper edge, one clear silhouette. No rain, no lightning, no sun rays, no multiple clouds.`,
  ["지상 프롭은 위로 뜬다. 화면 상단에 깔려 하늘을 움직이게 한다", FLOW_NOTE],
);

prop(
  "surface_lightning_afterglow",
  "벼락 잔광",
  8,
  `The faint AFTERGLOW of a lightning strike, a single short diagonal zigzag streak in dim washed-out white, already fading, isolated in empty space. Not a bright bolt, not the strike itself, no branching, no clouds, no scenery.`,
  [
    "번개 자체가 아니라 **잔광**이다 — 밝게 그리면 카드의 제우스 발광과 경쟁한다",
    "알파를 CSS로 깜박이게 한다 — 프레임을 그리지 않는다",
    FLOW_NOTE,
  ],
);

prop(
  "surface_incense",
  "제단 향 연기",
  24,
  `A single thin ribbon of smoke rising and curling, wider at the top than the bottom, semi-transparent, nothing else in the frame. No censer, no altar, no fire, no embers.`,
  ["위로 뜨는 지상 프롭의 대표다. 제단 봉헌물 위에 깔린다", FLOW_NOTE],
);

prop(
  "surface_olive_leaf",
  "올리브 잎",
  16,
  `A single olive leaf, a narrow pointed oval with a visible centre rib, seen at a slight angle as if drifting. Dull olive green, desaturated. No branch, no twig, no fruit, no cluster.`,
  [
    "아테나의 올리브와 같은 소재다 — 카드 `athena_utility`의 올리브 관과 색을 맞춘다",
    FLOW_NOTE,
  ],
);

prop(
  "surface_eagle",
  "독수리",
  16,
  `A single eagle in flight seen from below at a distance, wings spread wide and flat, one clear dark silhouette with almost no interior detail. No talons, no prey, no perch, no multiple birds.`,
  [
    "제우스의 새다 — 「신들이 지켜본다」의 배경 장치라 크게 그리지 않는다. 16px 실루엣으로 끝난다",
    FLOW_NOTE,
  ],
);

prop(
  "surface_ribbon",
  "찢긴 봉헌 리본",
  24,
  `A single strip of torn votive ribbon hanging and fluttering, frayed at the loose end, one clear vertical strip. Faded dull gold. No knot, no pole, no wreath, no multiple ribbons.`,
  [
    "봉헌물이 그대로 썩은 신전이라는 배경 설정에 붙는다 — 새것처럼 그리면 안 된다",
    FLOW_NOTE,
  ],
);

prop(
  "surface_light_shaft",
  "신전 틈으로 드는 빛줄기",
  32,
  `A single narrow diagonal shaft of pale light with hard edges, brighter at its upper end and fading out at the lower end, semi-transparent. No dust motes, no window, no architecture, no lens flare.`,
  [
    "§0.4의 위쪽 빛과 같은 방향이다 — 위에서 아래로, 상단이 밝다",
    "**밝게 그리면 패널 글자를 잡아먹는다.** 화면 상단 `header` 자리에만 배치한다",
  ],
);

// ─────────────────────────────────────────── UI 2개
add({
  path: "ui/marker.md",
  title: "`marker.png` — 지도 현재 위치 마커",
  ref: "§2.5",
  spec: "PNG 알파. **여기만 16×16이 곧 파일 크기다** — 격자 숫자가 화면 참고값인 다른 에셋과 반대다. `.map-node.current`에 얹힌다 — 지금은 테두리 색만 바뀌는데 **병사가 어디까지 올라왔는지가 지도의 핵심**이다.",
  gen: "1024×1024 — 정사각으로 뽑는다",
  convert:
    "# 16×16은 사람이 찍는 게 제일 깔끔하다. 생성으로 갈 때는 **box 필터로만** 줄인다 —\n# 기본 보간은 16px에서 실루엣을 회색 죽으로 만든다\nmagick art/_src/ui/marker.png -alpha on -fuzz 35% -transparent '#00ff00' \\\n  -trim +repage -filter box -resize 16x16 -colors 6 art/ui/marker.png",
  convertNote:
    "**이 한 장만 `-resize`가 허용된다.** 16×16이 최종 크기이자 원본 규격이라 축소가 손실이 아니다 — 대신 생성물은 `art/_src/ui/marker.png`에 그대로 남긴다.\n\n**줄인 뒤 눈으로 본다.** 16px에서 실루엣이 안 읽히면 그 자리에서 직접 찍는 게 빠르다 — 아래가 그 지침이다.",
  handNote:
    "**직접 찍는 쪽이 여전히 1순위다.** 생성 프롬프트는 실루엣 참고용이고, 16×16은 손으로 찍는 게 결과가 낫다.\n\n§5의 32×40 스프라이트를 **축소하지 말고 실루엣만 새로 찍는다** — 32×40을 16으로 줄이면 뭉갠다.\n\n16×16 안에 병사의 상반신 실루엣만. 위를 보는 자세는 유지한다. 색은 뼈색 실루엣 + 어두운 1픽셀 외곽선, 배경 투명. 쓰는 색은 **4~6개**로 끝낸다.",
  prompt: `A single tiny pixel-art map marker: the head and shoulders of one ancient Greek soldier in a battered helmet, seen from the front and TILTED UPWARD as if looking up at something far above him. Bust only, cut off at the chest, no arms, no weapon, no legs.

Read as an extremely coarse icon: built from very large flat square pixels, roughly 16 by 16 blocks across the whole image and no finer detail than that anywhere, a hard 1-pixel dark outline all the way around the silhouette, at most 5 flat colours total in bone white, cold gray-blue and near-black. The silhouette alone must identify it at 16 pixels wide.

Centred on a fully transparent background with even margins. No scenery, no ground, no shadow, no glow, no anti-aliasing, no gradients, no soft edges, no map, no pin shape, no arrow, no banner, no flag, no text, no watermark, no multiple poses.`,
  notes: [
    "격자 칸 `.map-node`가 97×30px이라 마커는 약 16px로 뜬다 — 그 이상 크면 칸을 넘는다",
    "**노드 아이콘 다섯(전·정·휴·?·보)은 P-33이 game-icons 벡터로 맡는다.** 여기서 그리지 않는다",
    "**핀·화살표·깃발을 그리지 않는다.** 지도 마커의 관습 도형을 넣으면 16px에서 그 도형만 남고 병사가 사라진다 — 병사의 상반신이 마커라는 게 이 한 장의 내용이다",
    "**위를 보는 자세가 §0.4의 상승이다.** 지도가 위에서 아래로 6층 → 1층을 깔고 병사는 위로 간다 — 마커가 아래를 보면 방향이 거꾸로 읽힌다",
  ],
});

add({
  path: "ui/card-frame.md",
  title: "`card-frame.png` — 카드 프레임",
  ref: "§3",
  spec: "PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** **1장이면 된다** — 신별 색은 `--zeus`·`--poseidon` 등 CSS 변수가 칠한다(`ui/style.css:100`).\n\n**화면** 카드 한 장이 약 105px, 아트 슬롯이 약 89×67이다. 프레임은 그 바깥 테두리다 — **참고값이다.**",
  gen: "1024×1024",
  convert:
    "magick art/_src/ui/card-frame.png -trim +repage -strip art/ui/card-frame.png\n\n# 여백만 자른다. 원본 해상도를 유지하면 고DPI에서 테두리가 흐려지지 않는다",
  convertNote:
    "**알파가 살아야 한다.** 프레임 안쪽은 완전 투명이어야 카드 아트가 보인다.",
  prompt: `A single ornate card border frame for a dark fantasy deckbuilding game, drawn as a thin hand-painted band of aged bronze and dark stone running around the edge of a vertical rectangle, with the ENTIRE INTERIOR completely empty and transparent. Slightly heavier at the top and bottom edges, a small notch at the top centre. Restrained and simple, readable at roughly 105 pixels wide.

The frame is a single flat colour band in muted bronze so a colour tint can be applied to it in code. Transparent background, alpha channel, border only, nothing inside the frame, no illustration, no text, no numbers, no gems, no filigree overload, no drop shadow, no glow, no watermark, no photorealism, no 3D render.`,
  notes: [
    "**신별로 5장을 그리지 않는다.** CSS 변수가 색을 칠하므로 무채색 청동 한 장이면 된다 — 그래서 프레임은 색을 최대한 단순하게 유지한다",
    "장식을 늘리면 89px 아트 슬롯을 먹는다. 얇은 띠가 정답이다",
  ],
});

// ─────────────────────────────────────────── 카드 16장 (신 4 × 태그 4)
const GODS = {
  poseidon: { ko: "포세이돈", hue: "a deep desaturated teal #2e7d8f, never cyan" },
  athena: { ko: "아테나", hue: "a dull olive bronze #7a8b5c, never lime" },
  ares: { ko: "아레스", hue: "a dark blood red #9b2226, never scarlet" },
  artemis: { ko: "아르테미스", hue: "a pale muted amethyst #8e7ca6, never violet" },
};

const TAGS = {
  attack: {
    ko: "공격",
    dir: "대각선",
    obj: {
      poseidon: ["trident", "wet black rock"],
      athena: ["spear", "pale cracked marble"],
      ares: ["battle axe", "scorched stone"],
      artemis: ["arrow", "dark bark and stone"],
    },
    line: (o, s) =>
      `A single bold ${o} symbol filling the frame, tearing DIAGONALLY from the top-left corner down to the bottom-right, striking a slab of ${s} in the lower third and splitting it with a few short cracks. Treat it like a game ability emblem: one instantly readable shape, thick and heavy, built from a few decisive angular strokes with hard corners. No thin lines, no branching filaments, no scenery, no architecture, no clouds. It spans the frame corner to corner and dominates it.`,
    note: "`zeus_attack`이 확정본이다 — 형태 문장을 그대로 쓰고 무기와 바닥 재질만 바꿨다",
  },
  defend: {
    ko: "방어",
    dir: "가로로 넓은 덩어리",
    obj: {
      poseidon: ["wall of standing water", ""],
      athena: ["section of a fortress rampart", ""],
      ares: ["slab of battle-scarred armour plate", ""],
      artemis: ["barricade of lashed timber and thorn", ""],
    },
    line: (o) =>
      `A single massive ${o} set at a slight angle across the LOWER HALF of the frame, wide and squat and heavy, filling the frame from left edge to right edge, bracing against something coming from above. One instantly readable horizontal mass, built from a few decisive angular strokes with hard corners. No round shield, no circle, no disc, no scenery, no architecture.`,
    note: "**원형은 쓰지 않는다** — 89px에서 구슬로 읽힌다",
  },
  token: {
    ko: "토큰",
    dir: "작은 것 여러 개가 흩어짐",
    obj: {
      poseidon: ["water droplets", ""],
      athena: ["bronze fragments", ""],
      ares: ["blood droplets", ""],
      artemis: ["arrow fletchings", ""],
    },
    line: (o) =>
      `Five or six small ${o} hanging scattered in mid-air across the frame at different heights, none of them touching, each one a simple hard-edged fragment, the whole spread reading as a scatter rather than a pile or a heap. No stack, no pile, no coins, no altar, no scenery, no architecture.`,
    note: "**더미로 쌓지 않는다** — 89px에서 동전 더미로 읽힌다. 흩어짐이 이 태그의 방향이다",
  },
  utility: {
    ko: "유틸리티",
    dir: "가운데가 빈 고리",
    obj: {
      poseidon: ["broken whirlpool ring", ""],
      athena: ["broken olive wreath", ""],
      ares: ["broken chain loop", ""],
      artemis: ["unstrung bow curve closing into a broken ring", ""],
    },
    line: (o) =>
      `A single thick ${o} filling the frame, drawn as a few decisive angular strokes with hard corners, its center completely empty and dark so the shape reads as a hollow circle with a gap in it. Nothing inside the ring, nothing behind it. No orb, no sphere, no filled disc, no scenery, no architecture, no clouds.`,
    note: "**가운데가 비어 있는 게 이 태그의 전부다.** 채우면 나머지 셋과 갈리는 값이 사라진다. 수직 구도도 금지 — `attack`과 붙는다",
  },
};

for (const [god, g] of Object.entries(GODS)) {
  for (const [tag, t] of Object.entries(TAGS)) {
    const [obj, stone] = t.obj[god];
    const blocked = god === "athena" || god === "artemis";
    add({
      path: `cards/${god}_${tag}.md`,
      title: `\`${god}_${tag}.webp\` — ${g.ko} · ${t.ko} 태그`,
      ref: "§3",
      spec: `WebP **가로 4:3**, **생성 원본 해상도 유지 — 축소하지 않는다.** \`.card-art\`가 \`aspect-ratio: 4/3\` + \`object-fit: cover\`라 비율만 맞으면 된다 — 세로 2:3으로 그리면 높이의 절반이 잘린다.\n\n**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**\n\n템플릿은 [\`zeus_attack.md\`](zeus_attack.md)에서 확정됐다. 격자는 둘로만 갈린다 — **태그 = 형태(${t.dir}), 신 = 색.**`,
      gen: "1536×1024 — 실제 출력이 1448×1086이면 이미 4:3이라 crop도 생략한다. **어느 쪽이든 축소하지 않는다**",
      convert: CARD_CONVERT(`${god}_${tag}`),
      convertNote: "용량은 22~31KB에 떨어진다(R-21 기준).",
      status: blocked
        ? "**생성 보류** — §3의 신 색 정본이 코드에서 확정(`ui/app.tsx`의 `godColors` 삭제)되기 전에는 그리지 않는다. CSS 변수와 `godColors`가 이 신만 **색상 자체**가 다르다"
        : "미생성",
      prompt: `${t.line(obj, stone)}\n\n${CARD_TAIL(ONE_HUE(g.hue))}`,
      notes: [
        t.note,
        `방향이 겹치면 썸네일에서 붙는다 — 같은 신의 4장은 대각선 / 가로 / 흩어짐 / 빈 고리로 갈린다`,
        "통과 기준: **원본은 그대로 두고** `/tmp`에만 깎아 본다 — `magick art/cards/파일 -resize 89x67! /tmp/t.png`. 같은 신의 4장을 나란히 놓고 **형태 넷이 갈리면 통과.** 신 색 면적이 25%를 넘거나 흰 코어가 생기면 재생성",
      ],
    });
  }
}

// ─────────────────────────────────────────── 융합 카드 10장
const FUSED = [
  ["card_fused_zeus_poseidon", "해일 벼락", "zeus", "poseidon",
   "a single thick bolt of gold driving down into the crest of one towering dark wave, the two shapes locking at the point of impact"],
  ["card_fused_zeus_ares", "피의 낙뢰", "zeus", "ares",
   "a single thick bolt of gold splitting a slab of dark red stone, the crack it opens running with the second colour"],
  ["card_fused_zeus_athena", "아이기스 뇌광", "zeus", "athena",
   "a single broad olive-bronze aegis shield taking a direct gold bolt across its face, the bolt breaking into forks along the rim"],
  ["card_fused_zeus_artemis", "사냥의 천둥", "zeus", "artemis",
   "a single arrow in flight whose shaft is a bolt of gold, drawn as one hard diagonal streak with a pale amethyst fletching"],
  ["card_fused_poseidon_ares", "핏빛 해류", "poseidon", "ares",
   "one heavy curl of dark teal water with a dark red current threading through its interior, the two colours braided but not blended"],
  ["card_fused_poseidon_athena", "해벽", "poseidon", "athena",
   "a wall of standing teal water held in place across the lower half by an olive-bronze rampart braced against it"],
  ["card_fused_poseidon_artemis", "달빛 파도", "poseidon", "artemis",
   "one broad teal wave with a pale amethyst crescent low behind it, the crescent's light catching only the wave's upper edge"],
  ["card_fused_athena_ares", "전쟁의 방패", "athena", "ares",
   "an olive-bronze shield seen wide and squat with a dark red axe head buried deep in its face, split radiating from the wound"],
  ["card_fused_athena_artemis", "달의 아이기스", "athena", "artemis",
   "an olive-bronze aegis shield with a pale amethyst crescent set into its centre as a hollow, the crescent's gap left dark"],
  ["card_fused_ares_artemis", "피의 사냥", "ares", "artemis",
   "a single dark red arrow driving diagonally through the frame with a pale amethyst trail breaking behind it"],
];

const HUE = {
  zeus: "a muted antique gold #d4a017",
  poseidon: "a deep desaturated teal #2e7d8f",
  athena: "a dull olive bronze #7a8b5c",
  ares: "a dark blood red #9b2226",
  artemis: "a pale muted amethyst #8e7ca6",
};
const KO = { zeus: "제우스", poseidon: "포세이돈", athena: "아테나", ares: "아레스", artemis: "아르테미스" };

for (const [id, ko, a, b, subject] of FUSED) {
  const blocked = [a, b].some((g) => g === "athena" || g === "artemis");
  add({
    path: `cards/${id}.md`,
    title: `\`${id}.webp\` — ${ko} (${KO[a]} + ${KO[b]})`,
    ref: "§3",
    spec: `WebP **가로 4:3**, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면은 약 89×67이지만 그건 참고값이다.\n\n**융합 10장은 폴백 대상이 아니다** — \`patron_pair\`라 \`{patron}_{tag}\` 폴백이 걸리지 않으므로 카드별 아트가 필수다.`,
    gen: "1536×1024 — 실제 출력이 1448×1086이면 crop도 생략한다. **어느 쪽이든 축소하지 않는다**",
    convert: CARD_CONVERT(id),
    convertNote: "용량은 22~31KB에 떨어진다(R-21 기준).",
    status: blocked
      ? "**생성 보류** — 아테나·아르테미스 색 정본이 코드에서 확정(`godColors` 삭제)된 뒤다"
      : "미생성",
    prompt: `A single fused emblem filling the frame: ${subject}. Treat it like a game ability emblem: one instantly readable shape built from a few decisive angular strokes with hard corners, thick and heavy, no thin lines, no scenery, no architecture, no clouds.\n\n${CARD_TAIL(
      `exactly TWO hues of light in the image and no others, ${HUE[a]} and ${HUE[b]}, each holding its own part of the shape and never blending into a third colour, together covering about one third of the frame`,
    )}`,
    notes: [
      "**융합만 두 색을 쓴다.** 나머지 20장은 「한 신 = 한 색」이 규칙이고, 융합은 그 규칙이 깨지는 것 자체가 사건이다 — 두 색이 섞여 제3의 색이 되면 그 값이 사라진다",
      "**컷인은 신규 에셋 0이다** — 융합 연출은 신 일러 두 장을 좌우 슬라이드인으로 처리한다(§4)",
      "통과 기준: **`/tmp`에만** 89×67로 깎아 두 색이 각각 식별되면 통과. 섞여서 갈색·회색이 되면 재생성 — **원본 파일은 건드리지 않는다**",
    ],
  });
}

// ─────────────────────────────────────────── 컷인 오버레이 2장
const overlay = (file, stage, subject, notes) =>
  add({
    path: `fx/${file}.md`,
    title: `\`${file}.webp\` — ${stage}`,
    ref: "§4",
    spec: "WebP **무손실 알파**, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.\n\n**화면** 1440×900 CSS. **여기가 축소가 가장 아픈 자리다** — 화면을 꽉 채우는 그림이라 화소가 그대로 값이고, DPR 2에서는 2880×1800이 필요하다. 생성 상한이 1536이라 그것도 못 채우니 **더 깎지 않는 게 유일한 대책이다.**\n\n`ui/fx.ts`의 `playSprite`가 화면 전체에 얹는다 — **지금 호출부가 없어 선행 코드 작업이 필요하다.**\n\n`favorStage`는 4단계지만 `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이다(`core/favor.ts:53`). 컷인도 그 둘만 — calm·anger는 없다.",
    gen: "1536×1024 — **가로로 뽑는다**, 투명 배경 옵션 ON",
    convert: OVERLAY_CONVERT(file),
    convertNote:
      "**알파가 필요하니 무손실로 저장한다.** 손실 WebP는 알파 경계를 망친다.\n\n**생성물을 먼저 `art/_src/fx/{name}.png`에 그대로 저장하고 나서 변환한다.** 지금 디스크의 세 장이 1440×900인데 `art/_src/fx/`가 비어 있는 게 이 순서를 건너뛴 결과다 — 원본이 없으니 되돌릴 방법이 재생성밖에 없다.\n\n**변환 후 크기를 확인한다:** `magick identify -format '%wx%h' art/fx/{name}.webp` — 1440×900이 나오면 어딘가에서 또 깎인 것이다. 1536×960이어야 한다.",
    status: "1440×900으로 깎인 상태 · 원본 없음 → 재생성 대상",
    prompt: subject,
    notes,
  });

// `block`·`burst`만 생성기에 있었고 `open`은 사이드카만 디스크에 남아 있었다 —
// 정본이 안 덮는 세 장 중 하나가 재생성 대상 셋 중 하나였다
overlay(
  "open",
  "헌신 컷인 오버레이 (길이 열린다)",
  `A full-screen transparent overlay effect: only several shafts of pale divine light splitting apart and pouring DOWNWARD from the very top edge of the frame, widening slightly as they descend, as if a sealed way has just opened from above. The light originates entirely at the top edge and fades out completely before reaching the middle. Soft muted golden-white beams with hard-edged gaps between them, with sparse restrained motes inside the beams.

The center and bottom of the image must be entirely empty of any effect so the game screen stays visible beneath it. ${OVERLAY_KEY} ${LANDSCAPE}

Flat magenta background, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.`,
  [
    "**위에서 내려오는 방향이 핵심이다.** 짝인 `block.webp`(진노)는 **아래로 누르는** 사슬·벽·거대한 손이다 — 병사는 위로 가려 하고 진노가 그걸 누른다. 컷인 한 장이 그 싸움을 말한다",
    "빛의 시작점이 화면 상단인 건 §0.4의 「위쪽 빛」과 같은 자리다 — 배경 여섯 장의 빛과 같은 곳에서 온다",
    "**중앙·하단은 완전 투명이어야 한다.** 뒤의 픽셀 전투 화면이 보여야 「신이 끼어든다」가 성립한다",
    "**신 색을 넣지 않는다.** 다섯 신이 이 한 장을 공유하므로 색은 코드가 칠한다 — 금색으로 그리면 제우스 전용이 된다",
  ],
);

overlay(
  "block",
  "진노 컷인 오버레이 (길이 막힌다)",
  `A full-screen transparent overlay effect: heavy chains, a slab of wall and one enormous open hand pressing DOWNWARD from the top of the frame, crossing the image horizontally and bearing down on whatever is beneath. The pressure reads as coming from above and pushing down. Hard-edged dark silhouettes with a thin rim of dull red light along their lower edges, no interior detail.

The lower third and the far left and right edges must be entirely empty of any effect so the game screen stays visible beneath it. ${OVERLAY_KEY} ${LANDSCAPE}

Flat magenta background, effect only, no scenery, no scenery, no characters, no figures, no faces, no text, no watermark, no frame, no vignette.`,
  [
    "**`open.webp`와 방향으로 갈린다.** 헌신은 위에서 갈라지며 내려오는 빛이고 진노는 **아래로 누른다** — 병사는 위로 가려 하고 진노가 그걸 누른다. 컷인 한 장이 그 싸움을 말한다",
    "**진노용 신 일러를 따로 그리지 않는다** — 붉은 그레이딩 + 글리치 오버레이를 코드가 얹는다",
    "**컷인에 병사를 넣지 않는다.** 병사는 컷인 뒤에 픽셀 스프라이트로 그대로 서 있고 오버레이가 그 위를 덮는다 — 그게 「끼어든다」의 그림이다",
  ],
);

overlay(
  "burst",
  "공용 파티클 오버레이",
  `A full-screen transparent overlay effect: a scatter of small hard-edged particles and embers thrown outward from the centre of the frame, densest in the middle band and thinning to nothing at the edges. Pale neutral white-grey particles with no colour of their own, varying sizes, no motion blur, no streaks.

The particles must be sparse enough that the game screen stays readable through them, and the very centre must stay clear. ${OVERLAY_KEY} ${LANDSCAPE}

Flat magenta background, effect only, no scenery, no scenery, no characters, no figures, no text, no watermark, no frame, no vignette.`,
  [
    "**색을 넣지 않는다.** `open`과 `block` 둘 다에 얹혀 세기를 올리는 공용 레이어라 신 색은 코드가 칠한다",
    "「화려하게」는 에셋이 아니라 연출이다 — 상징 스윕 → 신 일러 슬라이드인 → 화면 플래시 → 오버레이 → 컬러 그레이드, 5단 전부 WAAPI다",
    "입자를 촘촘히 그리면 그 아래 전투 화면이 안 읽힌다. 중앙은 비운다",
  ],
);

// ─────────────────────────────────────────── 신 일러 5장
// 계획이 「완료」로 적어 뒀지만 `art/`·`dist/`·`public/` 어디에도 파일이 없고 사이드카조차 없었다.
// 없으면 헌신·진노 컷인이 오버레이만 뜨고 정작 신이 안 나온다
const GOD_ART_CONVERT = (name) => `magick art/_src/gods/${name}.png -gravity center -crop 2:3 +repage \\
  -quality 90 art/gods/${name}.webp`;

const GOD_ART_STYLE = (hex, hue) => `Composition: VERTICAL PORTRAIT, aspect ratio 2:3, taller than wide — the opposite of every background and overlay in this set. The figure stands full height, centred, filling most of the frame height, with its feet near the bottom edge and headroom above. The left and right thirds stay dark and quiet: two of these images slide in from opposite sides and sit side by side during a fusion cut-in, so nothing important may touch the left or right edge.

Style: hand-painted 2D illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline along the edge of the figure. Not a flat vector icon, not a 3D render, not photorealistic, not a glossy mobile-game gacha portrait.

Lighting and colour: ${ONE_HUE(hue)}. That single hue is the ONLY colour in the image and it BURNS out of near-total darkness — the whole rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture. ${hex} exactly, never neon, never white-hot, never a white core, no rainbow, no secondary colour, no complementary accent.

The body is UNDAMAGED and flawless: no wounds, no rot, no blood, no gore, nothing torn. No soldier, no second figure, no mortal, no scales, no card frame, no border, no vignette, no text, no numbers, no logo, no watermark, no UI, no bloom, no lens flare.`;

const godArt = (file, ko, hex, hue, subject, notes) =>
  add({
    path: `gods/${file}.md`,
    title: `\`${file}.webp\` — ${ko} 컷인 일러`,
    ref: "§4",
    status: "미생성 · 사이드카도 없었다",
    spec: "WebP **세로 2:3**, **생성 원본 해상도 유지 — 축소하지 않는다.**\n\n**화면** 중앙 세로 컷인 약 600×900 CSS. `ui/fx.ts`의 `playSprite`가 얹을 자리다.\n\n**헌신·진노 두 단계가 이 한 장을 같이 쓴다** — `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이고(`core/favor.ts:53`), **진노용 일러를 따로 그리지 않는다.** 붉은 그레이딩 + 글리치는 코드가 얹는다.\n\n**융합 10쌍도 신규 에셋 0이다** — 이 다섯 장 중 두 장을 좌우에서 슬라이드인시킨다.",
    gen: "1024×1536 — **세로로 뽑는다**",
    convert: GOD_ART_CONVERT(file),
    convertNote:
      "**여기만 세로다.** 배경·오버레이·주인공 일러가 전부 가로 16:10인 것과 반대라 크기 확인 기준도 반대다 — `magick identify`의 폭이 높이보다 **작아야** 맞다.\n\n생성물은 `art/_src/gods/{name}.png`에 그대로 남긴다. `art/fx/`·`art/hero/`가 원본 없이 깎인 게 이 순서를 건너뛴 결과다.",
    prompt: `${subject}\n\n${GOD_ART_STYLE(hex, hue)}`,
    notes: [
      ...notes,
      `**신 색은 §3 정본 하나뿐이다** — ${ko}는 \`${hex}\`. \`ui/style.css:2\` CSS 변수 쪽이 정본이고 \`ui/app.tsx:37\` \`godColors\`는 범례에서만 쓰인다`,
      "**병사를 넣지 않는다.** 신 일러가 화면을 차지하는 순간이라 둘이 겹치면 신이 작아진다 — 병사는 컷인 **뒤**에 픽셀 스프라이트로 그대로 서 있고 오버레이가 그 위를 덮는다",
      "**여기는 하데스 2 톤이다**(§0.5). 픽셀이 저채도 DD2를 지키니 컷인은 반대로 간다 — 어둠 위에서 신 색 하나가 발광한다. 저채도로 그리면 순간적으로 뜨는 컷인이 사건으로 안 읽힌다",
      "**32×32 진노 스프라이트(`enemy_god_*.png`)와 같은 신이지만 규칙이 반대다** — 스프라이트는 신 색 2~3픽셀이 상한이고 여기는 화면의 1/4이다. 매체가 다르면 톤도 다르다",
    ],
  });

godArt(
  "zeus",
  "제우스",
  "#d4a017",
  "an antique gold #d4a017",
  `A cut-in illustration of Zeus appearing to intervene in a mortal's climb out of the Underworld. A towering bearded figure seen from slightly below, one arm raised straight ABOVE the head gripping a lightning javelin whose length runs the full height of the frame. Heavy draped himation over one shoulder, bare chest, no helmet, no shield. His face is in shadow; only the raised arm and the javelin catch the light. The pose is a blow held back, not yet thrown.`,
  [
    "**위로 뻗은 팔이 이 장의 전부다.** 다섯 중 유일하게 세로로 뻗는 실루엣이고 세로 2:3과 맞는다 — 팔을 내리면 프레임의 위 절반이 빈다",
    "번개창이 프레임 높이를 다 쓰게 한다 — 가로 배경에서는 못 하는 구도라 컷인이 세로인 이유가 여기다",
  ],
);

godArt(
  "poseidon",
  "포세이돈",
  "#2e7d8f",
  "a dark sea teal #2e7d8f",
  `A cut-in illustration of Poseidon appearing to intervene. A broad bearded figure standing planted, gripping a trident driven VERTICALLY into the ground before him, and behind that trident a standing wall of dark water rises the full height of the frame, its crest curling but not breaking. The water is the largest shape in the image; the figure reads through it as a dark silhouette. Heavy soaked drapery, no helmet.`,
  [
    "**물의 벽이 실루엣의 절반이다.** 신 색이 놓이는 자리는 그 벽의 윗선이다 — 물 전체를 칠하면 프레임의 1/4을 넘어 어둠이 사라진다",
    "삼지창이 세로로 박힌 자세라 제우스의 든 팔과 방향이 갈린다 — 둘이 융합 컷인에서 나란히 뜰 수 있다(`card_fused_zeus_poseidon`)",
  ],
);

godArt(
  "athena",
  "아테나",
  "#7a8b5c",
  "a dull olive bronze #7a8b5c",
  `A cut-in illustration of Athena appearing to intervene. A tall figure in a crested Corinthian helmet with the visor down, holding a large ROUND aegis shield out toward the viewer so it covers the centre of the frame, spear held low and angled down at her side. The shield's rim catches the only light in the image. Composed, still, blocking rather than striking.`,
  [
    "**방패가 원형이라는 게 유일한 구별점이다** — 스파르토이 방패병과 청동 탈로스 파편은 사각 방패다(§1.5). 원형이 아테나의 자리",
    "**투구를 벗기지 않는다.** 얼굴을 그리면 이 세트에서 유일하게 인상이 남는 신이 되고 다섯의 무게가 어긋난다",
    "창을 낮춘 자세다 — 든 창은 아레스의 것이라 겹치면 `#9b2226`과 `#7a8b5c`만으로 갈려야 한다",
  ],
);

godArt(
  "ares",
  "아레스",
  "#9b2226",
  "a deep blood red #9b2226",
  `A cut-in illustration of Ares appearing to intervene. A lean armoured figure leaning FORWARD and downward out of the frame toward the viewer, weight far over the front foot, a single long spear thrust ahead of him. NO shield anywhere in the image. A closed helmet with only the eye slits visible, nothing of the face. The forward tilt is extreme enough that the silhouette alone reads as attacking.`,
  [
    "**`#9b2226`은 이미 모든 픽셀 스프라이트의 핏빛 강조색이다** — 그래서 아레스만 색으로 안 갈린다. **앞으로 기운 각도와 방패 없음**이 그 몫을 진다",
    "이걸 피하려고 아레스 색을 밝히면 §3 정본이 흔들리고 카드 20장이 같이 어긋난다 — 색은 건드리지 않는다",
    "**고어를 넣지 않는다.** 전쟁의 신이지만 신은 훼손되지 않는다(§1.5) — 피는 창끝의 색으로만 있다",
  ],
);

godArt(
  "artemis",
  "아르테미스",
  "#8e7ca6",
  "a pale washed amethyst #8e7ca6",
  `A cut-in illustration of Artemis appearing to intervene. A slender figure standing BACK and turned partly away, bow drawn to full tension with the arrow already aimed, the drawn bowstring and arrowhead the only lit things in the frame. She keeps her distance — the whole pose reads as withdrawal, not advance. Short hunting chiton, quiver, no helmet, hair bound back.`,
  [
    "**다섯 중 유일하게 거리를 두는 자세다.** 원거리 실루엣이 세트에 없어서 이 한 장이 그 자리를 맡는다 — 앞으로 나오면 아레스와 겹친다",
    "당긴 화살촉에 신 색이 놓인다 — 활 전체를 칠하면 실루엣이 뭉개진다",
    "`#8e7ca6`이 정본이다 — `godColors`의 초록(`#75c66a`)은 **다른 색이고 쓰지 않는다.** 초록으로 그리면 다시 그리는 일이 된다",
  ],
);

// ─────────────────────────────────────────── 주인공 일러 3장
const hero = (file, where, subject, notes) =>
  add({
    path: `hero/${file}.md`,
    title: `\`${file}.webp\` — ${where}`,
    ref: "§5",
    spec: "WebP, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.\n\n**화면** 1440×900 CSS. 컷인 오버레이와 같은 이유로 **축소가 가장 아픈 자리다** — DPR 2에서 2880×1800이 필요한데 생성 상한이 1536이다.\n\n**주인공이 일러로 나오는 자리는 셋뿐이다** — 전투 화면에는 없다(픽셀이 맡는다).",
    gen: "1536×1024 — **가로로 뽑는다**",
    convert: HERO_CONVERT(file),
    convertNote:
      "알파 없음 — 화면을 채운다. 손실 WebP로 충분하다.\n\n**생성물을 먼저 `art/_src/hero/{name}.png`에 그대로 저장하고 나서 변환한다.** 지금 디스크의 세 장이 1440×900인데 `art/_src/hero/`가 비어 있는 게 이 순서를 건너뛴 결과다.\n\n**변환 후 크기를 확인한다:** `magick identify -format '%wx%h' art/hero/{name}.webp` — 1536×960이어야 한다. 1440×900이면 또 깎인 것이다.",
    status: "1440×900으로 깎인 상태 · 원본 없음 → 재생성 대상",
    prompt: `${subject}\n\n${LANDSCAPE}`,
    notes,
  });

hero(
  "hero-title",
  "타이틀 화면 (`.setup`)",
  `A dark hand-painted illustration for a game title screen. At the bottom of a vast underworld shaft, a lone ancient Greek soldier in ruined armour stands looking UPWARD toward a distant light. Behind and above him, filling the upper part of the frame, hangs an enormous pair of scales: in one pan the soldier himself, in the other the hands of gods reaching in to press it down. He is small; the scales are the largest thing in the image.

Composition: horizontal, wide. The UPPER LEFT QUADRANT must be kept dark, quiet and free of important detail, because a very large title headline is laid over it. The soldier sits low and right of centre; the scales occupy the upper right.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, heavy shadow, near-black background #11131a with charcoal and deep navy, one narrow shaft of pale light from above as the only light source. Muted and desaturated except that light. No text, no title, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no bloom, no lens flare.`,
  [
    "**h1이 최대 6.4rem으로 크게 얹히고 `.setup`이 `justify-items: start`다**(`ui/style.css:19`) — 좌측 상단을 비워 둔다",
    "**저울은 병사가 들지 않는다.** 신들이 그를 재는 것이라 손이 아니라 타이틀과 UI에 있다 — 그게 제목이 뜻하는 것이다",
    "병사가 작아야 한다. 크게 그리면 저울이 배경 장식이 되고 제목의 뜻이 사라진다",
  ],
);

hero(
  "hero-win",
  "승리 결과 화면 (`result`)",
  `A dark hand-painted illustration. A lone ancient Greek soldier in ruined armour steps THROUGH an open gate of light, seen entirely FROM BEHIND, his silhouette already half dissolved by the brightness swallowing him. The light fills the upper half of the frame completely; the ground he is leaving is dark.

Composition: horizontal, wide. All meaningful content sits in the UPPER HALF of the frame, because the lower half is fully covered by statistics panels. The soldier is centred and small against the gate.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, dominant colour a pale desaturated green-white #8fd6a4 in the light, everything else charcoal and near-black #11131a. No face, no front view, no text, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no lens flare.`,
  [
    "**`hero-loss`와 한 구도의 반전이라 두 장을 같이 설계한다.** 따로 설계하면 둘 다 약해진다",
    "`.outcome.win`이 `#8fd6a4`다(`ui/style.css:91`) — 일러의 지배색을 거기에 맞춘다",
    "**결과 화면은 아래쪽이 이미 붐빈다** — `.summary-grid` 4칸 + `.result-columns` + `.map-columns` 두 지역 격자. 일러는 상단 절반까지만 온다",
    "등만 보인다 — 얼굴을 그리면 32×40 스프라이트와 인상이 충돌한다",
  ],
);

hero(
  "hero-loss",
  "패배 결과 화면 (`result`)",
  `A dark hand-painted illustration, the deliberate INVERSION of the victory image. A lone ancient Greek soldier in ruined armour is being dragged DOWNWARD, seen from behind, dozens of thin ashen arms of the nameless dead locked around his ankles and legs pulling him back into the dark. Far above him the light he was climbing toward is receding to a narrow seam.

Composition: horizontal, wide. All meaningful content sits in the UPPER HALF of the frame, because the lower half is fully covered by statistics panels. The soldier is centred, tilted backward, the light small and high.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, dominant colour a desaturated warm red #eb887d in the fading light, everything else charcoal and near-black #11131a. No face, no front view, no gore, no text, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no lens flare.`,
  [
    "**패배 일러가 없으면 런의 70%가 아무 그림도 없이 끝난다** (6회차 승률 30.2%). 승리보다 자주 뜨는 화면이다",
    "`.outcome.loss`가 `#eb887d`다(`ui/style.css:91`) — 지배색을 거기에 맞춘다",
    "발목을 잡는 팔들이 스키아이(`enemy_under_swarm`)다 — 「같이 나가려고 매달린다」가 여기서 결말을 받는다",
    "**고어를 그리지 않는다.** 훼손이 아니라 끌려 내려가는 방향이 이 그림의 내용이다",
  ],
);

// 디스크 실측 상태 — 원본이 남아 있는지가 판정의 핵심이다 (art/README.md 「지금 소실된 것」)
const DISK_STATUS = {
  bg: "원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)",
  props: "원본 해상도 그대로 · 안 늦었다",
  sprites: "적 14 · 진노 신 5 · 주인공 생성 완료 · 원본 해상도 그대로",
  cards: "30장 생성 완료 · 원본 해상도 그대로",
};

// ─────────────────────────────────────────── 출력
const render = (d) => {
  const L = [];
  const up = "../".repeat(d.path.split("/").length);
  L.push(`# ${d.title}\n`);
  L.push(
    `[P-32](${up}plans/32-art.md) ${d.ref} · [원본 규칙](${up.slice(3)}README.md) · **상태 ${d.status ?? DISK_STATUS[d.path.split("/")[0]] ?? "미생성"}**\n`,
  );
  L.push(`**파일** ${d.spec}\n`);
  if (d.gen) {
    // `1536×1024 — **가로로 뽑는다**`처럼 코드 스팬 안에 강조가 들어가면 그대로 글자로 뜬다 — 크기와 지시를 갈라 놓는다
    const [size, ...rest] = d.gen.split(" — ");
    const alpha = (d.prompt && d.path.startsWith("sprites/")) || d.path.startsWith("props/") || d.path.startsWith("ui/");
    L.push(`**생성** GPT-image 2.0, \`${size}\`${rest.length ? ` — ${rest.join(" — ")}` : ""}${alpha ? ", **투명 배경 옵션 ON**, PNG" : ""}\n`);
  }
  if (d.convert) {
    L.push(`**변환** — 입력은 \`art/_src/\` 원본이고 출력은 \`art/\`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**\n`);
    L.push("```\n" + d.convert + "\n```\n");
    if (d.convertNote) L.push(`${d.convertNote}\n`);
  }
  if (d.handNote) L.push(`## 작업 방법\n\n${d.handNote}\n`);
  if (d.prompt) L.push(`## 프롬프트\n\n\`\`\`text\n${d.prompt}\n\`\`\`\n`);
  L.push(`## 주의\n`);
  L.push(d.notes.map((n) => `- ${n}`).join("\n") + "\n");
  return L.join("\n");
};

for (const d of docs) {
  const full = `${ROOT}/${d.path}`;
  mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
  writeFileSync(full, render(d));
}
console.log(`${docs.length}개 생성`);
