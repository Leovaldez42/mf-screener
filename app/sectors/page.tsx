"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Delta } from "@/components/ui";

type Row = { sector: string; net_value_delta_cr: number; net_qty_delta: number };

export default function SectorsPage() {
  const search = useSearchParams();
  const month = search.get("month") || "";
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const q = month ? `?month=${month}` : "";
    fetch(`/api/v1/sectors${q}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []));
  }, [month]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Sectors</h1>
      <p className="text-sm text-zinc-400">Net quantity and rupee change across active equity books for the month.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-normal">Sector</th>
              <th className="py-2 pr-3 font-normal">Net qty</th>
              <th className="py-2 font-normal">Net ₹ cr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sector} className="border-t border-zinc-800">
                <td className="py-2 pr-3">{r.sector}</td>
                <td className="py-2 pr-3">
                  <Delta value={r.net_qty_delta} />
                </td>
                <td className="py-2">
                  <Delta value={r.net_value_delta_cr} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
