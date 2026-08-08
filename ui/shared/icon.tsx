import type { MapNodeType } from "../../core/map.ts";
import type { PassiveName, TokenName } from "../../core/state.ts";
import sheet from "../../art/icons.svg?raw";

/**
 * 이름이 유니온인 이유는 **오타가 조용히 빈 자리로 뜨기 때문이다.** 시트에 없는 id를 `<use>`가 가리키면
 * 아무 일도 안 일어난다 — 경고도 없다. 여기서 컴파일이 막히고, 시트 쪽 28개는 `tools/art.ts`가 센다
 */
type IntentKind = "damage" | "block" | "heal" | "token" | "favor" | "idle";
export type IconName = TokenName | PassiveName | MapNodeType | IntentKind;

/**
 * 시트를 **같은 문서 안에** 심는다. `<use href="파일.svg#id">`처럼 외부 파일을 가리키면 요청이 한 번
 * 더 가고 브라우저에 따라 조용히 빈다 — `?raw`로 번들에 실으면 요청은 0회다. 앱 뿌리에 한 번만 선다
 */
export const IconSheet = () => <span className="icon-sheet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sheet }} />;

/** 크기는 자리가 정한다(`ui/style.css`) — 같은 아이콘이 격자에서 16px, 선택지에서 24px로 뜬다 */
export const Icon = ({ name }: { name: IconName }) => (
  <svg className="icon" aria-hidden="true"><use href={`#icon-${name}`} /></svg>
);
