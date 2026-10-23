import { verifyJournalPosting } from "../../../../../lib/journal-postings";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { posting, reconciled } = await verifyJournalPosting((await params).id);
    return reconciled
      ? Response.json({ posting, message: "The existing AutoCount journal was found and its date, currency, accounts and debit/credit amounts match. No new journal was created." })
      : Response.json({ posting, error: "AutoCount returned a journal, but its details do not match this workpaper. No new journal was created; review the record manually." }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify the existing AutoCount journal.";
    return Response.json({ error: message }, { status: message === "Posting record not found." ? 404 : 502 });
  }
}
