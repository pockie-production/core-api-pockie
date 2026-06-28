import { Test, TestingModule } from '@nestjs/testing';
import { InternalDashboardService } from './internal-dashboard.service';

describe('InternalDashboardService', () => {
  let service: InternalDashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InternalDashboardService],
    }).compile();

    service = module.get<InternalDashboardService>(InternalDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
