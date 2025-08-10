import { Test, TestingModule } from '@nestjs/testing';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';

describe('StockAnalysisAgentService', () => {
  let service: StockAnalysisAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockAnalysisAgentService],
    }).compile();

    service = module.get<StockAnalysisAgentService>(StockAnalysisAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
