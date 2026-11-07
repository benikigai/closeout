import assessment from '@/server/assessment.json';
import Closeout from '@/components/Closeout';

export default function Page() {
  return <Closeout assessment={assessment} />;
}
