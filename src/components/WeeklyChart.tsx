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
import { WeeklyData, formatDate } from '../api';

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
  loading?: boolean;
}

/**
 * Weekly performance chart - displays 7-day coding time trends
 * Each user gets a unique colored line
 */
export function WeeklyChart({ data, loading }: WeeklyChartProps) {
  const chartRef = useRef<any>(null);

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

  // Prepare chart data
  const chartData = {
    labels: data.dates.map(formatDate),
    datasets: data.users.map((user, index) => {
      // Create a map of date -> seconds for quick lookup
      const dataMap = new Map(
        user.daily_data.map(d => [d.date, d.seconds])
      );

      // Fill in data for all dates (use 0 if no data)
      const values = data.dates.map(date => {
        const seconds = dataMap.get(date) || 0;
        return seconds / 3600; // Convert to hours for better readability
      });

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
          color: document.documentElement.classList.contains('dark') 
            ? 'rgb(229, 231, 235)' 
            : 'rgb(17, 24, 39)',
          usePointStyle: true,
          padding: 10,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y?.toFixed(1) ?? '0.0';
            return `${label}: ${value}h`;
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
          callback: (value) => `${value}h`,
          color: document.documentElement.classList.contains('dark')
            ? 'rgb(156, 163, 175)'
            : 'rgb(75, 85, 99)',
          font: {
            size: window.innerWidth < 640 ? 9 : 11,
          },
        },
        grid: {
          color: document.documentElement.classList.contains('dark')
            ? 'rgba(75, 85, 99, 0.2)'
            : 'rgba(209, 213, 219, 0.5)',
        },
      },
      x: {
        ticks: {
          color: document.documentElement.classList.contains('dark')
            ? 'rgb(156, 163, 175)'
            : 'rgb(75, 85, 99)',
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
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Weekly Performance
      </h2>
      <div className="h-64 sm:h-72">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}
