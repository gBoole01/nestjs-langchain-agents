import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BroaderReportsService } from './broader-reports.service';
import {
  BroaderReport,
  BroaderReportSchema,
} from './models/broader-report.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BroaderReport.name, schema: BroaderReportSchema },
    ]),
  ],
  providers: [BroaderReportsService],
  exports: [BroaderReportsService],
})
export class BroaderAnalysisModule {}
