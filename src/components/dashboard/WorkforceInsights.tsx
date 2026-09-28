"use client";

import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { BarChart3, PieChart, TrendingUp, Table } from "lucide-react";
import { EmployeeSummary } from "@/types";
import { CHART_COLORS, PALETTE } from "@/lib/constants";
import { parseIsoDate, daysBetween, startOfDay, lastTwelveMonths } from "@/lib/date-utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface WorkforceInsightsProps {
  employees: EmployeeSummary[];
}

export function WorkforceInsights({ employees }: WorkforceInsightsProps) {
  const [showDataTables, setShowDataTables] = useState(false);

  // 1. Department Breakdown (Top 10)
  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      const dept = emp.department || "Unassigned";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);

    return {
      labels: sorted.map((item) => item[0]),
      datasets: [
        {
          label: "Employees",
          data: sorted.map((item) => item[1]),
          backgroundColor: CHART_COLORS.indigo,
          borderRadius: 6,
          barThickness: 16,
        },
      ],
    };
  }, [employees]);

  // 2. Company Breakdown (Doughnut)
  const companyData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      const c = emp.company || "Other";
      counts[c] = (counts[c] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return {
      labels: entries.map((item) => item[0]),
      datasets: [
        {
          data: entries.map((item) => item[1]),
          backgroundColor: PALETTE.slice(0, entries.length),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [employees]);

  // 3. Gender Distribution (Doughnut)
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      const g = emp.gender || "Not specified";
      counts[g] = (counts[g] || 0) + 1;
    });
    const entries = Object.entries(counts);

    return {
      labels: entries.map((item) => item[0]),
      datasets: [
        {
          data: entries.map((item) => item[1]),
          backgroundColor: [CHART_COLORS.sky, CHART_COLORS.violet, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.slate],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [employees]);

  // 4. Tenure Bands
  const tenureData = useMemo(() => {
    const counts: Record<string, number> = {
      "< 6 months": 0,
      "6–12 months": 0,
      "1–2 years": 0,
      "2–5 years": 0,
      "5+ years": 0,
      "DOJ missing": 0,
    };
    const today = startOfDay(new Date());

    employees.forEach((emp) => {
      const doj = parseIsoDate(emp.doj);
      if (!doj) {
        counts["DOJ missing"] += 1;
        return;
      }
      const days = Math.max(0, daysBetween(doj, today));
      if (days < 183) counts["< 6 months"] += 1;
      else if (days < 365) counts["6–12 months"] += 1;
      else if (days < 730) counts["1–2 years"] += 1;
      else if (days < 1826) counts["2–5 years"] += 1;
      else counts["5+ years"] += 1;
    });

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          label: "Headcount",
          data: Object.values(counts),
          backgroundColor: [
            CHART_COLORS.sky,
            CHART_COLORS.indigo,
            CHART_COLORS.violet,
            CHART_COLORS.emerald,
            CHART_COLORS.amber,
            CHART_COLORS.light,
          ],
          borderRadius: 6,
        },
      ],
    };
  }, [employees]);

  // 5. Hiring Trend (Last 12 Months)
  const hiringTrendData = useMemo(() => {
    const months = lastTwelveMonths();
    const counts: Record<string, number> = {};
    months.forEach((m) => (counts[m.key] = 0));

    employees.forEach((emp) => {
      const doj = parseIsoDate(emp.doj);
      if (!doj) return;
      const key = `${doj.getFullYear()}-${String(doj.getMonth() + 1).padStart(2, "0")}`;
      if (Object.prototype.hasOwnProperty.call(counts, key)) {
        counts[key] += 1;
      }
    });

    return {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "New Joinees",
          data: Object.values(counts),
          borderColor: CHART_COLORS.indigo,
          backgroundColor: "rgba(79, 70, 229, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: CHART_COLORS.indigo,
          borderWidth: 2.5,
        },
      ],
    };
  }, [employees]);

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: CHART_COLORS.navy,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: "#EEF2F7" }, ticks: { precision: 0, font: { size: 11 } } },
    },
  };

  const horizontalBarOptions = {
    ...baseChartOptions,
    indexAxis: "y" as const,
    scales: {
      x: { beginAtZero: true, grid: { color: "#EEF2F7" }, ticks: { precision: 0 } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 10, padding: 12, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: CHART_COLORS.navy,
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <section id="insights" className="mb-10 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Workforce Demographics
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-DEFAULT tracking-tight">
            Workforce Insights
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Aggregated analytics dynamically reacting to global filters.
          </p>
        </div>

        {/* Accessible Data Table Toggle */}
        <button
          onClick={() => setShowDataTables(!showDataTables)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-borderline bg-surface hover:bg-slate-50 text-slate-700 transition self-start sm:self-center"
        >
          <Table className="w-3.5 h-3.5 text-indigo-600" />
          <span>{showDataTables ? "Show Graphical Charts" : "Show Accessible Data Tables"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Department Breakdown */}
        <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-DEFAULT">
                Employees by Department
              </h3>
              <p className="text-xs text-muted">Top 10 functional divisions</p>
            </div>
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="h-64 relative">
            {showDataTables ? (
              <div className="overflow-y-auto h-full text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400">
                      <th className="py-1">Department</th>
                      <th className="py-1 text-right">Headcount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentData.labels.map((lbl, idx) => (
                      <tr key={lbl} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{lbl}</td>
                        <td className="py-1.5 text-right font-bold text-indigo-600">
                          {departmentData.datasets[0].data[idx]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Bar data={departmentData} options={horizontalBarOptions} />
            )}
          </div>
        </div>

        {/* Chart 2: Records by Company */}
        <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-DEFAULT">
                Distribution by Company
              </h3>
              <p className="text-xs text-muted">Entity proportion in workforce</p>
            </div>
            <PieChart className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-64 relative">
            {showDataTables ? (
              <div className="overflow-y-auto h-full text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400">
                      <th className="py-1">Company</th>
                      <th className="py-1 text-right">Headcount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyData.labels.map((lbl, idx) => (
                      <tr key={lbl} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{lbl}</td>
                        <td className="py-1.5 text-right font-bold">
                          {companyData.datasets[0].data[idx]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Doughnut data={companyData} options={doughnutOptions} />
            )}
          </div>
        </div>

        {/* Chart 3: Gender Distribution */}
        <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-DEFAULT">
                Gender Diversity
              </h3>
              <p className="text-xs text-muted">Gender representation balance</p>
            </div>
            <PieChart className="w-4 h-4 text-sky-600" />
          </div>

          <div className="h-64 relative">
            {showDataTables ? (
              <div className="overflow-y-auto h-full text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400">
                      <th className="py-1">Gender</th>
                      <th className="py-1 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genderData.labels.map((lbl, idx) => (
                      <tr key={lbl} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{lbl}</td>
                        <td className="py-1.5 text-right font-bold">
                          {genderData.datasets[0].data[idx]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Doughnut data={genderData} options={doughnutOptions} />
            )}
          </div>
        </div>

        {/* Chart 4: Tenure Bands */}
        <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-DEFAULT">
                Tenure Demographics
              </h3>
              <p className="text-xs text-muted">Retention & employee experience cohorts</p>
            </div>
            <BarChart3 className="w-4 h-4 text-violet-600" />
          </div>

          <div className="h-64 relative">
            {showDataTables ? (
              <div className="overflow-y-auto h-full text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400">
                      <th className="py-1">Tenure Bracket</th>
                      <th className="py-1 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenureData.labels.map((lbl, idx) => (
                      <tr key={lbl} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{lbl}</td>
                        <td className="py-1.5 text-right font-bold">
                          {tenureData.datasets[0].data[idx]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Bar data={tenureData} options={baseChartOptions} />
            )}
          </div>
        </div>

        {/* Chart 5: Joining Trend (Spanning Full Width on Desktop) */}
        <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-DEFAULT">
                12-Month Joining & Growth Trend
              </h3>
              <p className="text-xs text-muted">Monthly onboarding velocity</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="h-64 relative">
            {showDataTables ? (
              <div className="overflow-y-auto h-full text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400">
                      <th className="py-1">Month</th>
                      <th className="py-1 text-right">New Hires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hiringTrendData.labels.map((lbl, idx) => (
                      <tr key={lbl} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{lbl}</td>
                        <td className="py-1.5 text-right font-bold text-indigo-600">
                          {hiringTrendData.datasets[0].data[idx]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Line data={hiringTrendData} options={baseChartOptions} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
