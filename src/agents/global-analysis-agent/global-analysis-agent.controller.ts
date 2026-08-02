import {
  Body,
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
import { RunGlobalAnalysisDto } from './dto/run-global-analysis.dto';
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
  run(@Body() dto: RunGlobalAnalysisDto): RunRecord {
    return this.analysisRunsService.start('global-analysis', dto, () =>
      this.globalAnalysisAgentService.runAnalysis(dto.query),
    );
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
