import {
  BadRequestException,
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
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { RunRecord } from 'src/runs/run.types';
import { PortfolioService } from 'src/tools/portfolio/portfolio.service';
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
    private readonly portfolioService: PortfolioService,
  ) {}

  @Post('runs')
  @HttpCode(202)
  async run(@Body() dto: RunStockAnalysisDto): Promise<RunRecord> {
    if (!(await this.portfolioService.isTracked(dto.ticker))) {
      throw new BadRequestException(
        `Ticker ${dto.ticker} is not in the portfolio or watchlist`,
      );
    }
    if (await this.hasAlreadyRunToday(dto.ticker)) {
      throw new ConflictException(
        `Analysis for ${dto.ticker} has already run today`,
      );
    }
    return this.analysisRunsService.start('stock-analysis', dto, () =>
      this.stockAnalysisAgentGraphService.runAgent(dto.ticker),
    );
  }

  @Post('runs/batch')
  @HttpCode(202)
  async runBatch(@Body() dto: RunStockAnalysisBatchDto): Promise<RunRecord[]> {
    const trackedFlags = await Promise.all(
      dto.tickers.map((ticker) => this.portfolioService.isTracked(ticker)),
    );
    const untracked = dto.tickers.filter((_, index) => !trackedFlags[index]);
    if (untracked.length > 0) {
      throw new BadRequestException(
        `Tickers not in the portfolio or watchlist: ${untracked.join(', ')}`,
      );
    }

    const alreadyRunFlags = await Promise.all(
      dto.tickers.map((ticker) => this.hasAlreadyRunToday(ticker)),
    );
    const alreadyRun = dto.tickers.filter(
      (_, index) => alreadyRunFlags[index],
    );
    if (alreadyRun.length > 0) {
      throw new ConflictException(
        `Analysis already run today for: ${alreadyRun.join(', ')}`,
      );
    }

    return dto.tickers.map((ticker) =>
      this.analysisRunsService.start('stock-analysis', { ticker }, () =>
        this.stockAnalysisAgentGraphService.runAgent(ticker),
      ),
    );
  }

  private async hasAlreadyRunToday(ticker: string): Promise<boolean> {
    if (this.analysisRunsService.hasPendingRunToday('stock-analysis', ticker)) {
      return true;
    }
    return this.archivistAgentService.hasReportToday(ticker);
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
