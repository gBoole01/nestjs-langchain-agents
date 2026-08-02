import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BroaderReport,
  BroaderReportDocument,
  BroaderReportDomain,
} from './models/broader-report.model';

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
  ): Promise<void> {
    await this.broaderReportModel.create({
      domain,
      subject,
      reportContent,
      date: new Date(),
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
   * already saved within the last `months` months.
   */
  async hasReportWithinWindow(
    domain: BroaderReportDomain,
    months: number,
    subject?: string,
  ): Promise<boolean> {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);

    const filter: Record<string, any> = { domain, date: { $gte: cutoff } };
    if (subject) {
      filter.subject = subject;
    }

    return Boolean(await this.broaderReportModel.exists(filter));
  }
}
