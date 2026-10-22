import { cloudStatus, fetchCloudAccounts } from "../../../../lib/autocount-cloud";

export async function GET() {
  const status = cloudStatus();
  if (!status.configured) return Response.json({ ...status, accounts: [] });
  try { return Response.json({ ...status, accounts: await fetchCloudAccounts(), syncedAt: new Date().toISOString() }); }
  catch (error) { return Response.json({ ...status, error: error instanceof Error ? error.message : "Account sync failed" }, { status: 502 }); }
}
