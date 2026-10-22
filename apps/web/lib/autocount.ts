import { cloudStatus } from "./autocount-cloud";
export function adapterStatus() {
  const status = cloudStatus();
  return { adapter: status.configured ? "autocount-cloud" : "not-connected", accountBookId: status.accountBookId, credentialsConfigured: status.configured, missing: status.missing };
}
