import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function DashboardFeedbackRedirect({ params }: PageProps) {
  const { sessionId } = await params;
  redirect(`/clinical-master/feedback/${sessionId}`);
}
