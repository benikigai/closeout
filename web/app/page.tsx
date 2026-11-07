import run from "@/data/run.json";
import measured from "@/data/demo-payload.json";
import Closeout from "@/components/Closeout";

export default function Page() {
  // SubQ's FA picks stay on the server until the judge sends their own.
  const { subq_picks: _hidden, ...fa } = run.fa;
  return <Closeout run={{ ...run, fa }} measured={measured} />;
}
