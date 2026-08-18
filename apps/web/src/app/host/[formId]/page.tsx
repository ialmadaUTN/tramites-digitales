import { HostForm } from '../../../features/host/ui/host-form';

export default async function HostPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <HostForm formId={formId} />;
}
