import { aiRiskBadgeClass, aiRiskLabel } from "../../lib/aiRegister";

export default function AIRiskBadge({ value }) {
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + aiRiskBadgeClass(value)}>
      {aiRiskLabel(value)}
    </span>
  );
}
