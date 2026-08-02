import { WriterReport } from '../stock-analysis-agent.types';

const SENTIMENT_LABEL: Record<WriterReport['overallSentiment'], string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
};

const PRICE_TREND_LABEL: Record<WriterReport['priceTrend'], string> = {
  up: 'Up',
  down: 'Down',
  flat: 'Flat',
};

export function renderReportMarkdown(
  ticker: string,
  date: string,
  report: WriterReport,
): string {
  const header = [
    `# ${ticker} — ${date}`,
    `**Overall Sentiment:** ${SENTIMENT_LABEL[report.overallSentiment]}`,
    `**Price Trend:** ${PRICE_TREND_LABEL[report.priceTrend]}`,
  ].join('\n');

  const body = report.sections
    .map((section) => `## ${section.heading}\n\n${section.content}`)
    .join('\n\n');

  return `${header}\n\n${body}`;
}
