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
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { RunRecord } from 'src/runs/run.types';
import { ArchivistAgentService } from './crew/archivist-agent.service';
import { PortfolioAnalystAgentService } from './crew/portfolio-analyst.service';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { RunStockAnalysisBatchDto } from './dto/run-stock-analysis-batch.dto';
import { RunStockAnalysisDto } from './dto/run-stock-analysis.dto';
import { ReportDocument } from './models/reports.model';
import { StockAnalysisAgentGraphService } from './stock-analysis-agent-graph.service';

@Controller('stock-analysis')
export class StockAnalysisAgentController {
  constructor(
    private readonly stockAnalysisAgentGraphService: StockAnalysisAgentGraphService,
    private readonly archivistAgentService: ArchivistAgentService,
    private readonly portfolioAnalystAgentService: PortfolioAnalystAgentService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('runs')
  @HttpCode(202)
  run(@Body() dto: RunStockAnalysisDto): RunRecord {
    return this.analysisRunsService.start('stock-analysis', dto, () =>
      this.stockAnalysisAgentGraphService.runAgent(dto.ticker),
    );
  }

  @Post('runs/batch')
  @HttpCode(202)
  runBatch(@Body() dto: RunStockAnalysisBatchDto): RunRecord[] {
    return dto.tickers.map((ticker) =>
      this.analysisRunsService.start('stock-analysis', { ticker }, () =>
        this.stockAnalysisAgentGraphService.runAgent(ticker),
      ),
    );
  }

  @Post('portfolio-analysis')
  @HttpCode(202)
  runPortfolioAnalysis(): RunRecord {
    return this.analysisRunsService.start('portfolio-analysis', {}, () =>
      this.portfolioAnalystAgentService.analyzePortfolio().then((result) => {
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      }),
    );
  }

  @Get('reports')
  listReports(@Query() query: ListReportsQueryDto): Promise<ReportDocument[]> {
    return this.archivistAgentService.listReports(query.ticker);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string): Promise<ReportDocument> {
    const report = await this.archivistAgentService.getReportById(id);
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return report;
  }
}
