import { HostForm } from '../../../features/host/ui/host-form';
import { signHostContext } from '../../../features/host/context-token';

export default async function HostPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const demoInsuranceCode = process.env.DEMO_INSURANCE_CODE ?? '2050';
  const externalVariables = { insuranceCode: demoInsuranceCode, variable1: demoInsuranceCode, variable2: demoInsuranceCode };
  return <HostForm formId={formId} externalVariables={externalVariables} contextToken={signHostContext(formId, externalVariables)} />;
}
