import { Test, TestingModule } from '@nestjs/testing';
import { SerperWebService } from './serper-web.service';

describe('SerperWebService', () => {
  let service: SerperWebService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SerperWebService],
    }).compile();

    service = module.get<SerperWebService>(SerperWebService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
