import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { run } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import { App } from "../ui/app.tsx";
import { replayPayload } from "../ui/export.ts";

describe("browser replay export", () => {
  it("renders the setup screen through React", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("신들의 저울");
    expect(markup).toContain("런 시작");
    expect(markup).toContain("aria-label=\"상태 토큰\"");
  });

  it("replays the same outcome, progress, and final favor", () => {
    const actions: ReplayAction[] = ["combat", "rest", "combat", "rest"].map((choice) => ({ type: "path", choice } as ReplayAction));
    const browser = run(42, undefined, actions);
    const replay = replayPayload(42, actions);
    const cli = run(replay.seed, undefined, replay.actions);

    expect({ won: cli.won, floors: cli.hpCurve.length - 1, favor: cli.favorCurve.at(-1) }).toEqual({
      won: browser.won,
      floors: browser.hpCurve.length - 1,
      favor: browser.favorCurve.at(-1),
    });
    expect(replay.replay_mode).toBe("action_log");
  });
});
