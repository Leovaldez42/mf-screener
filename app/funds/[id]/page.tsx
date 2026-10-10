import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFundPayload } from "@/lib/cached-holdings";
import { FundView } from "./fund-view";

type Props = { params: Promise<{ id: string }> };

export default async function FundRoute({ params }: Props) {
  const { id } = await params;
  const familyId = Number(id);
  if (!Number.isFinite(familyId)) notFound();
  const payload = await getFundPayload(familyId, "");
  if ("error" in payload && payload.error === "not_found") notFound();
  return (
    <Suspense fallback={<p className="text-sm text-faint">Loading…</p>}>
      <FundView />
    </Suspense>
  );
}
