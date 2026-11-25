import type { EChartsCoreOption } from 'echarts/core';
import { DateRange } from '../../../core/api/models';
import { dateLocale } from '../../../core/format/date-locale';
import { DurationPipe } from '../../../core/format/format.pipes';
import { ChartContext, escapeHtml, periodLabel } from '../dashboard-charts';
import {
  Bucket,
  FitnessGranularity,
  FitnessPoint,
  HrBand,
  SpeedMetric,
  efficiency,
  inBand,
  linearFit,
  longest,
  meanSpeed,
  metricValue,
  rollingMean,
  splitByTime,
} from './fitness-metrics';

const PRIMARY = '#1f6feb';
const POINT = 'rgba(31, 111, 235, 0.45)';
/** Rampa sequenziale (un solo tono, chiaro -> scuro): periodo più vecchio -> più recente. */
const PERIOD_RAMP = ['#9ec5fe', '#5b9bf5', '#0b4fb3'];
const ENDURANCE = '#12a594';

const duration = new DurationPipe();
const pad = (n: number) => String(n).padStart(2, '0');

/** Secondi al km -> "5:07". */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Passo "5:07 /km" o velocità "28,4 km/h" nella lingua attiva. */
export function formatMetric(value: number, metric: SpeedMetric, lang: string): string {
  if (metric === 'pace') return `${formatPace(value)} /km`;
  const n = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${n.format(value)} km/h`;
}

export function formatEfficiency(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Data `dd/MM/yyyy` di un istante "da muro" (ora locale dell'attività codificata in UTC). */
function wallDate(t: number, lang: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), { dateStyle: 'short', timeZone: 'UTC' }).format(
    new Date(t),
  );
}

function wallDayMonth(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

function metricAxis(metric: SpeedMetric, ctx: ChartContext) {
  return {
    type: 'value',
    scale: true,
    name: ctx.t(metric === 'pace' ? 'dashboard.fitness.axis.pace' : 'dashboard.fitness.axis.speed'),
    axisLabel: {
      formatter: (v: number) => (metric === 'pace' ? formatPace(v) : String(round(v, 1))),
    },
    splitLine: { lineStyle: { opacity: 0.4 } },
  };
}

function pointLines(p: FitnessPoint, metric: SpeedMetric, ctx: ChartContext): string[] {
  return [
    escapeHtml(wallDate(p.t, ctx.lang)),
    `${escapeHtml(ctx.t('dashboard.fitness.tooltip.hr'))}: ${Math.round(p.hr)} bpm`,
    `${escapeHtml(ctx.t(metric === 'pace' ? 'dashboard.fitness.tooltip.pace' : 'dashboard.fitness.tooltip.speed'))}: ${formatMetric(metricValue(p.speedMps, metric), metric, ctx.lang)}`,
    `${escapeHtml(ctx.t('dashboard.fitness.tooltip.duration'))}: ${duration.transform(p.movingS)}`,
  ];
}

/** A · Indice di efficienza per attività + media mobile 28 giorni. */
export function efficiencyOption(
  points: readonly FitnessPoint[],
  metric: SpeedMetric,
  ctx: ChartContext,
): EChartsCoreOption {
  const rolling = rollingMean(points, efficiency);
  const pointsName = ctx.t('dashboard.fitness.efficiency.points');
  const rollingName = ctx.t('dashboard.fitness.efficiency.rolling');
  return {
    aria: { enabled: true, label: { description: ctx.t('dashboard.fitness.efficiency.title') } },
    grid: { left: 8, right: 16, top: 32, bottom: 32, containLabel: true },
    legend: { bottom: 0, data: [pointsName, rollingName] },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const { dataIndex, seriesIndex } = params as { dataIndex: number; seriesIndex: number };
        const p = points[dataIndex];
        const value = seriesIndex === 0 ? efficiency(p) : rolling[dataIndex];
        const label = seriesIndex === 0 ? pointsName : rollingName;
        return [
          `${escapeHtml(label)}: <b>${formatEfficiency(value, ctx.lang)}</b>`,
          ...pointLines(p, metric, ctx),
        ].join('<br/>');
      },
    },
    xAxis: { type: 'time', axisLabel: { formatter: (v: number) => wallDayMonth(v) } },
    yAxis: {
      type: 'value',
      scale: true,
      name: ctx.t('dashboard.fitness.axis.efficiency'),
      splitLine: { lineStyle: { opacity: 0.4 } },
    },
    series: [
      {
        type: 'scatter',
        name: pointsName,
        symbolSize: 9,
        itemStyle: { color: POINT },
        data: points.map((p) => [p.t, round(efficiency(p), 3)]),
      },
      {
        type: 'line',
        name: rollingName,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: PRIMARY },
        itemStyle: { color: PRIMARY },
        data: points.map((p, i) => [p.t, round(rolling[i], 3)]),
      },
    ],
  };
}

/** B · Passo/velocità rispetto alla FC, per terzi del periodo, con retta di tendenza. */
export function paceHrOption(
  points: readonly FitnessPoint[],
  range: DateRange,
  metric: SpeedMetric,
  ctx: ChartContext,
): EChartsCoreOption {
  const groups = splitByTime(points, range, 3);
  const names = ['early', 'middle', 'recent'].map((k) => ctx.t(`dashboard.fitness.paceHr.${k}`));
  const scatter = groups.map((group, i) => ({
    type: 'scatter',
    name: names[i],
    symbolSize: 9,
    itemStyle: { color: PERIOD_RAMP[i], borderColor: '#fff', borderWidth: 1 },
    data: group.map((p) => [Math.round(p.hr), round(metricValue(p.speedMps, metric), 2)]),
  }));
  const trends = groups.flatMap((group, i) => {
    const xs = group.map((p) => p.hr);
    const fit = linearFit(
      xs,
      group.map((p) => metricValue(p.speedMps, metric)),
    );
    if (fit === null) return [];
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    return [
      {
        type: 'line',
        name: names[i],
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { width: 2, color: PERIOD_RAMP[i], type: i === 2 ? 'solid' : 'dashed' },
        data: [lo, hi].map((x) => [x, round(fit.intercept + fit.slope * x, 2)]),
      },
    ];
  });
  return {
    aria: {
      enabled: true,
      label: { description: ctx.t(`dashboard.fitness.paceHr.title.${metric}`) },
    },
    grid: { left: 8, right: 16, top: 32, bottom: 32, containLabel: true },
    legend: { bottom: 0, data: names },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const { seriesIndex, dataIndex } = params as { seriesIndex: number; dataIndex: number };
        const p = groups[seriesIndex]?.[dataIndex];
        if (p === undefined) return '';
        return [`<b>${escapeHtml(names[seriesIndex])}</b>`, ...pointLines(p, metric, ctx)].join(
          '<br/>',
        );
      },
    },
    xAxis: {
      type: 'value',
      scale: true,
      name: ctx.t('dashboard.fitness.axis.hr'),
      nameLocation: 'middle',
      nameGap: 24,
    },
    yAxis: metricAxis(metric, ctx),
    series: [...scatter, ...trends],
  };
}

/** C · Passo/velocità medi per periodo nelle sole attività dentro la fascia di FC. */
export function bandOption(
  buckets: readonly Bucket[],
  band: HrBand,
  granularity: FitnessGranularity,
  metric: SpeedMetric,
  ctx: ChartContext,
): EChartsCoreOption {
  const labels = buckets.map((b) => periodLabel(b.start, granularity, ctx));
  const banded = buckets.map((b) => b.points.filter((p) => inBand(p, band)));
  const values = banded.map((ps) => {
    const s = meanSpeed(ps);
    return s === null ? null : round(metricValue(s, metric), 2);
  });
  return {
    aria: { enabled: true, label: { description: ctx.t(`dashboard.fitness.band.hint.${metric}`) } },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as { dataIndex: number };
        const v = values[first.dataIndex];
        const lines = [escapeHtml(labels[first.dataIndex])];
        lines.push(
          v === null
            ? escapeHtml(ctx.t('dashboard.fitness.tooltip.none'))
            : `<b>${formatMetric(v, metric, ctx.lang)}</b>`,
          `${escapeHtml(ctx.t('dashboard.chart.count'))}: ${banded[first.dataIndex].length}`,
        );
        return lines.join('<br/>');
      },
    },
    xAxis: { type: 'category', data: labels },
    yAxis: metricAxis(metric, ctx),
    series: [
      {
        type: 'line',
        connectNulls: true,
        symbolSize: 8,
        lineStyle: { width: 2, color: PRIMARY },
        itemStyle: { color: PRIMARY },
        data: values,
      },
    ],
  };
}

/** D · Durata dell'attività più lunga per periodo dentro la fascia di FC (minuti). */
export function enduranceOption(
  buckets: readonly Bucket[],
  band: HrBand,
  granularity: FitnessGranularity,
  ctx: ChartContext,
): EChartsCoreOption {
  const labels = buckets.map((b) => periodLabel(b.start, granularity, ctx));
  const values = buckets.map((b) => {
    const s = longest(b.points.filter((p) => inBand(p, band)));
    return s === null ? null : Math.round(s / 60);
  });
  return {
    aria: { enabled: true, label: { description: ctx.t('dashboard.fitness.endurance.hint') } },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as { dataIndex: number };
        const v = values[first.dataIndex];
        return [
          escapeHtml(labels[first.dataIndex]),
          v === null
            ? escapeHtml(ctx.t('dashboard.fitness.tooltip.none'))
            : `<b>${duration.transform(v * 60)}</b>`,
        ].join('<br/>');
      },
    },
    xAxis: { type: 'category', data: labels },
    yAxis: {
      type: 'value',
      name: ctx.t('dashboard.fitness.axis.minutes'),
      axisLabel: { formatter: (v: number) => duration.transform(v * 60) },
      splitLine: { lineStyle: { opacity: 0.4 } },
    },
    series: [
      {
        type: 'line',
        connectNulls: true,
        symbolSize: 8,
        lineStyle: { width: 2, color: ENDURANCE },
        itemStyle: { color: ENDURANCE },
        areaStyle: { color: ENDURANCE, opacity: 0.12 },
        data: values,
      },
    ],
  };
}
