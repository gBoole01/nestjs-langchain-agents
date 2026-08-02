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
import { BackfillSectorDto } from './dto/backfill-sector.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { RunSectorAnalysisDto } from './dto/run-sector-analysis.dto';
import { SectorialAnalysisAgentService } from './sectorial-analysis-agent.service';

@Controller('sectorial-analysis')
export class SectorialAnalysisAgentController {
  constructor(
    private readonly sectorialAnalysisAgentService: SectorialAnalysisAgentService,
    private readonly broaderReportsService: BroaderReportsService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('runs')
  @HttpCode(202)
  async run(@Body() dto: RunSectorAnalysisDto): Promise<RunRecord> {
    if (await this.sectorialAnalysisAgentService.hasFreshReport(dto.sector)) {
      throw new ConflictException(
        `Sectorial analysis for ${dto.sector} has already run within the last 3 months`,
      );
    }
    return this.analysisRunsService.start('sector-analysis', dto, () =>
      this.sectorialAnalysisAgentService.runAnalysis(dto.sector),
    );
  }

  @Post('runs/all')
  @HttpCode(202)
  runAll(): RunRecord {
    return this.analysisRunsService.start('sector-analysis-all', {}, () =>
      this.sectorialAnalysisAgentService
        .runAnalysisForAllSectors()
        .then(() => 'All sectors analyzed.'),
    );
  }

  @Post('backfill')
  @HttpCode(202)
  backfill(@Body() dto: BackfillSectorDto): RunRecord {
    if (this.analysisRunsService.hasPendingRun('sector-analysis-backfill')) {
      throw new ConflictException(
        'A sectorial analysis backfill is already in progress',
      );
    }
    return this.analysisRunsService.start('sector-analysis-backfill', dto, () =>
      this.sectorialAnalysisAgentService
        .backfillAllSectors(dto.from, dto.to, dto.sectors)
        .then((summary) => JSON.stringify(summary)),
    );
  }

  @Get('sectors')
  listSectors(): { sector: string }[] {
    return this.sectorialAnalysisAgentService.listSectors();
  }

  @Get('reports')
  listReports(
    @Query() query: ListReportsQueryDto,
  ): Promise<BroaderReportDocument[]> {
    return this.broaderReportsService.list('sectorial', query.sector);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string): Promise<BroaderReportDocument> {
    const report = await this.broaderReportsService.getById('sectorial', id);
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return report;
  }
}
