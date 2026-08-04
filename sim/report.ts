export type RunResult = { won: boolean; turns: number; log: string[] };

export function summarize(results: RunResult[]): { runs: number; wins: number; winRate: number; averageTurns: number } {
  const wins = results.filter(({ won }) => won).length;
  return {
    runs: results.length,
    wins,
    winRate: results.length ? wins / results.length : 0,
    averageTurns: results.length ? results.reduce((sum, { turns }) => sum + turns, 0) / results.length : 0,
  };
}

export function renderReport(report: ReturnType<typeof summarize>): string {
  return `runs=${report.runs} wins=${report.wins} win_rate=${report.winRate.toFixed(3)} avg_turns=${report.averageTurns.toFixed(2)}`;
}
