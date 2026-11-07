import assessment from '@/server/assessment.json';
import Landing from '@/components/Landing';
import { verifyHeldout } from '@/server/firmware';

export default async function Page() {
  // Runs the compiled firmware on the held-out builds when the page is built.
  const heldout = await verifyHeldout().catch(() => null);
  return <Landing assessment={assessment} heldout={heldout} />;
}
