import { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { WeeklyData, Metric, METRICS, formatDate } from '../api';
import { useTheme } from '../ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface WeeklyChartProps {
  data: WeeklyData | null;
  metric?: Metric;
  onMetricChange?: (metric: Metric) => void;
  loading?: boolean;
}

/**
 * Weekly performance chart - displays 7-day coding activity trends
 * Each user gets a unique colored line. Metric toggle switches
 * between total / human / AI time and AI lines.
 */
export function WeeklyChart({ data, metric = 'total', onMetricChange, loading }: WeeklyChartProps) {
  const chartRef = useRef<any>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isLines = metric === 'lines';

  // Generate distinct colors for each user
  const colors = [
    'rgb(59, 130, 246)',   // blue
    'rgb(168, 85, 247)',   // purple
    'rgb(236, 72, 153)',   // pink
    'rgb(34, 197, 94)',    // green
    'rgb(251, 146, 60)',   // orange
    'rgb(14, 165, 233)',   // sky
    'rgb(234, 179, 8)',    // yellow
    'rgb(239, 68, 68)',    // red
  ];

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Weekly Performance
        </h2>
        <div className="h-64 sm:h-72 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Convert stored value into chart units (seconds -> hours for time metrics)
  const toChartValue = (value: number) => (isLines ? value : value / 3600);

  // Prepare chart data
  const chartData = {
    labels: data.dates.map(formatDate),
    datasets: data.users.map((user, index) => {
      // Create a map of date -> value for quick lookup
      const dataMap = new Map(
        user.daily_data.map(d => [
          d.date,
          toChartValue(
            metric === 'total' ? d.seconds :
            metric === 'human' ? d.human_seconds :
            metric === 'ai' ? d.ai_seconds :
            d.ai_lines
          ),
        ])
      );

      // Fill in data for all dates (use 0 if no data)
      const values = data.dates.map(date => dataMap.get(date) || 0);

      const color = colors[index % colors.length];

      return {
        label: user.display_name || user.username,
        data: values,
        borderColor: color,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    }),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? 'rgb(161, 161, 170)' : 'rgb(71, 85, 105)',
          usePointStyle: true,
          padding: 12,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y ?? 0;
            return `${label}: ${isLines ? Math.round(value) : value.toFixed(1)}${isLines ? ' lines' : 'h'}`;
          },
          beforeBody: (tooltipItems) => {
            // Sort tooltip items by value in descending order
            tooltipItems.sort((a, b) => {
              const aValue = a.parsed.y ?? 0;
              const bValue = b.parsed.y ?? 0;
              return bValue - aValue;
            });
            return [];
          },
        },
        itemSort: (a, b) => {
          // Sort by value descending (highest first)
          return (b.parsed.y ?? 0) - (a.parsed.y ?? 0);
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => (isLines ? `${value}` : `${value}h`),
          color: isDark ? 'rgb(161, 161, 170)' : 'rgb(71, 85, 105)',
          font: {
            size: window.innerWidth < 640 ? 9 : 11,
          },
        },
        grid: {
          color: isDark ? 'rgba(63, 63, 70, 0.5)' : 'rgba(226, 232, 240, 0.8)',
        },
      },
      x: {
        ticks: {
          color: isDark ? 'rgb(161, 161, 170)' : 'rgb(71, 85, 105)',
          font: {
            size: window.innerWidth < 640 ? 9 : 11,
          },
          maxRotation: window.innerWidth < 640 ? 45 : 0,
          minRotation: window.innerWidth < 640 ? 45 : 0,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Weekly Performance
        </h2>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => onMetricChange?.(m.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metric === m.value
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 sm:h-72">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}
