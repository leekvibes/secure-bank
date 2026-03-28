"use client";

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const PLAN_COLORS: Record<string, string> = {
  FREE: "#6B7280",
  BEGINNER: "#3B82F6",
  PRO: "#00A3FF",
  AGENCY: "#8B5CF6",
};

export function SignupChart({ data }: { data: Array<{ date: string; signups: number }> }) {
  const formatted = data.map((d) => ({ ...d, date: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis dataKey="date" tick={{ fill: "#ffffff40", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "#0D1425", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff", fontSize: 12 }} />
        <Line type="monotone" dataKey="signups" stroke="#00A3FF" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LinkChart({ data }: { data: Array<{ date: string; links: number }> }) {
  const formatted = data.map((d) => ({ ...d, date: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis dataKey="date" tick={{ fill: "#ffffff40", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "#0D1425", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff", fontSize: 12 }} />
        <Bar dataKey="links" fill="#00A3FF" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlanDonutChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([plan, count]) => ({ name: plan, value: count }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={PLAN_COLORS[entry.name] ?? "#6B7280"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "#0D1425", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff", fontSize: 12 }} />
        <Legend formatter={(v) => <span style={{ color: "#ffffff80", fontSize: 11 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
