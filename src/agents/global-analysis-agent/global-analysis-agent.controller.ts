import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BroaderReportsService } from 'src/agents/broader-analysis/broader-reports.service';
import { BroaderReportDocument } from 'src/agents/broader-analysis/models/broader-report.model';
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { RunRecord } from 'src/runs/run.types';
import { BackfillGlobalDto } from './dto/backfill-global.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { GlobalAnalysisAgentService } from './global-analysis-agent.service';

@Controller('global-analysis')
export class GlobalAnalysisAgentController {
  constructor(
    private readonly globalAnalysisAgentService: GlobalAnalysisAgentService,
    private readonly broaderReportsService: BroaderReportsService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('runs')
  @HttpCode(202)
  async run(): Promise<RunRecord> {
    if (await this.globalAnalysisAgentService.hasFreshReport()) {
      throw new ConflictException(
        'Global analysis has already run within the last 6 months',
      );
    }
    return this.analysisRunsService.start('global-analysis', {}, () =>
      this.globalAnalysisAgentService.runAnalysis(),
    );
  }

  @Post('backfill')
  @HttpCode(202)
  backfill(@Body() dto: BackfillGlobalDto): RunRecord {
    if (this.analysisRunsService.hasPendingRun('global-analysis-backfill')) {
      throw new ConflictException(
        'A global analysis backfill is already in progress',
      );
    }
    return this.analysisRunsService.start('global-analysis-backfill', dto, () =>
      this.globalAnalysisAgentService
        .backfill(dto.from, dto.to, dto.periods)
        .then((summary) => JSON.stringify(summary)),
    );
  }

  @Get('missing-periods')
  getMissingPeriods(): Promise<string[]> {
    return this.globalAnalysisAgentService.getMissingPeriods();
  }

  @Get('reports')
  listReports(
    @Query() query: ListReportsQueryDto,
  ): Promise<BroaderReportDocument[]> {
    return this.broaderReportsService.list('global', query.subject);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string): Promise<BroaderReportDocument> {
    const report = await this.broaderReportsService.getById('global', id);
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return report;
  }
}
