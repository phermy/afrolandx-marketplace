import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Applicant = { id: number; businessName: string; location: string; description: string; status: string };
type Earning = { id: number; eventId: number; grossNgn: number; commissionNgn: number; netNgn: number; status: string };
const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;

async function request(url: string, method = "GET", data?: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Please try again.");
  return body;
}

export default function EventPlannerAdmin() {
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const applicants = useQuery<Applicant[]>({
    queryKey: ["event-planner-applicants"],
    queryFn: () => request("/api/admin/event-planners"),
  });
  const earnings = useQuery<Earning[]>({
    queryKey: ["event-earnings"],
    queryFn: () => request("/api/admin/event-earnings"),
  });

  const updateStatus = async (id: number, status: "approved" | "suspended" | "rejected") => {
    setBusyId(id);
    setError("");
    try {
      await request(`/api/admin/event-planners/${id}/status`, "PATCH", { status });
      await client.invalidateQueries({ queryKey: ["event-planner-applicants"] });
      await client.invalidateQueries({ queryKey: ["event-planners"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Event planner administration</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {applicants.data?.map(planner => (
          <div key={planner.id} className="rounded border p-3 text-sm">
            <strong>{planner.businessName}</strong> · {planner.location} · {planner.status}
            <p className="whitespace-pre-wrap py-2">{planner.description}</p>
            <div className="flex gap-2">
              {(["approved", "suspended", "rejected"] as const)
                .filter(status => status !== planner.status)
                .map(status => (
                  <Button key={status} variant="outline" size="sm" disabled={busyId !== null}
                    onClick={() => updateStatus(planner.id, status)}>
                    {status === "approved" ? "Approve" : status === "suspended" ? "Suspend" : "Reject"}
                  </Button>
                ))}
            </div>
          </div>
        ))}
        {applicants.isLoading && <p className="text-sm">Loading applications…</p>}
        {!applicants.isLoading && !applicants.data?.length && !applicants.isError && <p className="text-sm">No planner applications yet.</p>}
        {applicants.isError && <p className="text-sm text-red-700">Applications could not be loaded.</p>}
        <h4 className="pt-3 font-semibold">Completed event commission records</h4>
        {earnings.data?.map(row => (
          <p key={row.id} className="rounded border p-2 text-sm">
            Event #{row.eventId}: quoted fee {money(row.grossNgn)} · Afrolandx commission {money(row.commissionNgn)} · fee after commission {money(row.netNgn)} · {row.status.replaceAll("_", " ")}
          </p>
        ))}
        {earnings.isError && <p className="text-sm text-red-700">Earnings could not be loaded.</p>}
      </CardContent>
    </Card>
  );
}