import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, TrendingUp } from "lucide-react";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];

export default function AdminAnalyticsCharts({ analytics }: { analytics: any }) {
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Actual Sales Revenue — Last 30 Days</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.revenueTrend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(date: string) => date.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => `₦${Number(value).toLocaleString()}`} />
              <Tooltip formatter={(value: number) => [`₦${Number(value).toLocaleString()}`, "Revenue"]} labelFormatter={(label: string) => `Date: ${label}`} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={analytics.ordersByStatus.filter((entry: any) => entry.count > 0)}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ status, count }: { status: string; count: number }) => `${status} (${count})`}
                  labelLine={false}
                >
                  {analytics.ordersByStatus.map((_: any, index: number) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {analytics.ordersByStatus.map((entry: any, index: number) => (
                <div key={entry.status} className="flex items-center gap-1 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="capitalize">{entry.status}: {entry.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Orders by Country</CardTitle></CardHeader>
          <CardContent>
            {analytics.geoDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.geoDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="country" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No geographic data yet. The chart will update as orders come in.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
