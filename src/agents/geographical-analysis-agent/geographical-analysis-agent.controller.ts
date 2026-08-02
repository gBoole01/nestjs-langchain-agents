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
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { RunGeoAnalysisDto } from './dto/run-geo-analysis.dto';
import { GeographicalAnalysisAgentService } from './geographical-analysis-agent.service';

@Controller('geographical-analysis')
export class GeographicalAnalysisAgentController {
  constructor(
    private readonly geographicalAnalysisAgentService: GeographicalAnalysisAgentService,
    private readonly broaderReportsService: BroaderReportsService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('runs')
  @HttpCode(202)
  async run(@Body() dto: RunGeoAnalysisDto): Promise<RunRecord> {
    if (await this.geographicalAnalysisAgentService.hasFreshReport(dto.region)) {
      throw new ConflictException(
        `Geographical analysis for ${dto.region} has already run within the last 3 months`,
      );
    }
    return this.analysisRunsService.start('geo-analysis', dto, () =>
      this.geographicalAnalysisAgentService.runAnalysis(dto.region),
    );
  }

  @Post('runs/all')
  @HttpCode(202)
  runAll(): RunRecord {
    return this.analysisRunsService.start('geo-analysis-all', {}, () =>
      this.geographicalAnalysisAgentService
        .runAnalysisForAllRegions()
        .then(() => 'All regions analyzed.'),
    );
  }

  @Get('regions')
  listRegions(): { region: string }[] {
    return this.geographicalAnalysisAgentService.listRegions();
  }

  @Get('reports')
  listReports(
    @Query() query: ListReportsQueryDto,
  ): Promise<BroaderReportDocument[]> {
    return this.broaderReportsService.list('geographical', query.region);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string): Promise<BroaderReportDocument> {
    const report = await this.broaderReportsService.getById('geographical', id);
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return report;
  }
}
