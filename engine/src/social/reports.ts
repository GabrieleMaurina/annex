export const REPORT_REASONS = [
  'collusion',
  'stream sniping',
  'verbal abuse',
  'fake botting',
  'stalling',
  'offensive picture',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
