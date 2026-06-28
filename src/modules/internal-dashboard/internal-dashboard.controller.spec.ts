import { Test, TestingModule } from '@nestjs/testing';
import { InternalDashboardController } from './internal-dashboard.controller';

describe('InternalDashboardController', () => {
  let controller: InternalDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalDashboardController],
    }).compile();

    controller = module.get<InternalDashboardController>(InternalDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
