import { Test, TestingModule } from '@nestjs/testing';
import { SerperNewsService } from './serper-news.service';

describe('SerperNewsService', () => {
  let service: SerperNewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SerperNewsService],
    }).compile();

    service = module.get<SerperNewsService>(SerperNewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
