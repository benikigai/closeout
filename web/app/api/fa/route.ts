import { NextResponse } from "next/server";
import run from "@/data/run.json";
import sealed from "@/data/sealed.json";

type Finding = { hypothesis: string; text: string; evidence: string };
const findings = sealed.findings as Record<string, Finding>;
const share = sealed.share as Record<string, number>;

function open(ids: string[]) {
  const results = ids.map((id) => ({ id, ...findings[id] }));
  const causes = [...new Set(results.map((r) => r.hypothesis))];
  const coverage = causes.reduce((sum, c) => sum + share[c], 0);
  return { results, causes, coverage };
}

// The FA lab. Findings stay on the server until a unit is sent.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const picks: unknown = body?.picks;
  if (
    !Array.isArray(picks) ||
    picks.length !== run.fa.budget ||
    new Set(picks).size !== picks.length ||
    !picks.every((id) => typeof id === "string" && id in findings)
  ) {
    return NextResponse.json({ error: `Send ${run.fa.budget} different unit IDs.` }, { status: 400 });
  }
  return NextResponse.json({
    you: open(picks as string[]),
    subq: open(run.fa.subq_picks),
    subq_picks: run.fa.subq_picks,
    baselines: run.fa.baselines,
  });
}
