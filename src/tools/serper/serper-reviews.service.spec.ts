import { Test, TestingModule } from '@nestjs/testing';
import { SerperReviewsService } from './serper-reviews.service';

describe('SerperReviewsService', () => {
  let service: SerperReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SerperReviewsService],
    }).compile();

    service = module.get<SerperReviewsService>(SerperReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
