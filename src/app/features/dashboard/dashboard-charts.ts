import type { EChartsCoreOption } from 'echarts/core';
import { Granularity, StatsSummary } from '../../core/api/models';
import { dateLocale } from '../../core/format/date-locale';
import { DurationPipe } from '../../core/format/format.pipes';
import { parseIsoDate } from '../../core/time/dates';

/** Contesto di localizzazione per i grafici: lingua attiva e traduzione sincrona. */
export interface ChartContext {
  lang: string;
  t: (key: string) => string;
}

const BAR_COLOR = '#1f6feb';
const SPORT_COLORS = ['#1f6feb', '#e8710a', '#12a594', '#d6409f', '#7c5cd6', '#c99a06', '#6b7280'];

const duration = new DurationPipe();
const pad = (n: number) => String(n).padStart(2, '0');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Nome tradotto dello sport; se manca la traduzione resta il codice grezzo. */
export function sportLabel(sport: string, ctx: ChartContext): string {
  const key = `sport.${sport}`;
  const label = ctx.t(key);
  return label === key ? sport : label;
}

/** Etichetta del periodo: giorno `dd/MM`, settimana `sett. dd/MM` / `wk dd/MM`, mese `MMM yyyy`. */
export function periodLabel(
  periodStart: string,
  granularity: Granularity,
  ctx: ChartContext,
): string {
  const date = parseIsoDate(periodStart);
  if (date === null) return periodStart;
  const dayMonth = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  switch (granularity) {
    case 'day':
      return dayMonth;
    case 'week':
      return `${ctx.t('dashboard.chart.weekPrefix')} ${dayMonth}`;
    case 'month':
      return new Intl.DateTimeFormat(dateLocale(ctx.lang), { month: 'short', year: 'numeric' }).format(date);
  }
}

/** Grafico a barre: distanza per periodo in km (1 decimale). */
export function barOption(stats: StatsSummary, ctx: ChartContext): EChartsCoreOption {
  const km = new Intl.NumberFormat(ctx.lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const labels = stats.series.map((p) => periodLabel(p.period_start, stats.granularity, ctx));
  return {
    aria: { enabled: true, label: { description: ctx.t('dashboard.chart.distanceTitle') } },
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as { dataIndex: number };
        const p = stats.series[first.dataIndex];
        return [
          escapeHtml(labels[first.dataIndex]),
          `${km.format(p.distance_m / 1000)} km`,
          `${escapeHtml(ctx.t('dashboard.chart.movingTime'))}: ${duration.transform(p.moving_s)}`,
          `${escapeHtml(ctx.t('dashboard.chart.count'))}: ${p.count}`,
        ].join('<br/>');
      },
    },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', name: 'km', axisLabel: { formatter: '{value}' } },
    series: [
      {
        type: 'bar',
        data: stats.series.map((p) => Math.round(p.distance_m / 100) / 10),
        itemStyle: { color: BAR_COLOR, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

/** Ciambella: tempo in movimento per sport. */
export function donutOption(stats: StatsSummary, ctx: ChartContext): EChartsCoreOption {
  return {
    color: SPORT_COLORS,
    aria: { enabled: true, label: { description: ctx.t('dashboard.chart.sportTitle') } },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `${escapeHtml(p.name)}<br/>${duration.transform(p.value)} (${Math.round(p.percent)}%)`;
      },
    },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        label: { show: false },
        data: stats.by_sport.map((s) => ({ name: sportLabel(s.sport, ctx), value: s.moving_s })),
      },
    ],
  };
}
