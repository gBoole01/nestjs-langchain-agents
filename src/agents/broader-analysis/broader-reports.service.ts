import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BroaderReport,
  BroaderReportDocument,
  BroaderReportDomain,
} from './models/broader-report.model';
import { getPeriodBounds } from './period.util';

@Injectable()
export class BroaderReportsService {
  constructor(
    @InjectModel(BroaderReport.name)
    private readonly broaderReportModel: Model<BroaderReportDocument>,
  ) {}

  async save(
    domain: BroaderReportDomain,
    subject: string,
    reportContent: string,
    period: string,
  ): Promise<void> {
    await this.broaderReportModel.create({
      domain,
      subject,
      reportContent,
      period,
      date: getPeriodBounds(period).end,
    });
  }

  async list(
    domain: BroaderReportDomain,
    subject?: string,
  ): Promise<BroaderReportDocument[]> {
    const filter = subject ? { domain, subject } : { domain };
    return this.broaderReportModel.find(filter).sort({ date: -1 }).exec();
  }

  async getById(
    domain: BroaderReportDomain,
    id: string,
  ): Promise<BroaderReportDocument | null> {
    return this.broaderReportModel.findOne({ _id: id, domain }).exec();
  }

  /**
   * Checks whether a report for the given domain (and optional subject) was
   * already saved on or after `cutoff` (typically the start of the current
   * reporting period for that domain/subject's cadence).
   */
  async hasReportWithinWindow(
    domain: BroaderReportDomain,
    cutoff: Date,
    subject?: string,
  ): Promise<boolean> {
    const filter: Record<string, any> = { domain, date: { $gte: cutoff } };
    if (subject) {
      filter.subject = subject;
    }

    return Boolean(await this.broaderReportModel.exists(filter));
  }

  /**
   * Checks whether a report already exists for this exact domain/subject/
   * period combination, independent of the now-relative freshness window.
   * Used by backfill to skip periods that have already been generated.
   */
  async hasReportForPeriod(
    domain: BroaderReportDomain,
    subject: string,
    period: string,
  ): Promise<boolean> {
    return Boolean(
      await this.broaderReportModel.exists({ domain, subject, period }),
    );
  }
}
