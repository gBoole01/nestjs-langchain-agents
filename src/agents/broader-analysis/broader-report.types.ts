import { z } from 'zod';

export const broaderReportSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Section heading.'),
        content: z
          .string()
          .describe('Markdown content of the section (no heading itself).'),
      }),
    )
    .min(1)
    .describe('Ordered sections making up the report.'),
});

export type BroaderReportSections = z.infer<typeof broaderReportSchema>;
