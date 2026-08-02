import { BroaderReportSections } from './broader-report.types';

export function renderBroaderReportMarkdown(
  subject: string,
  periodLabel: string,
  report: BroaderReportSections,
): string {
  const header = `# ${subject} — ${periodLabel}`;

  const body = report.sections
    .map((section) => `## ${section.heading}\n\n${section.content}`)
    .join('\n\n');

  return `${header}\n\n${body}`;
}
