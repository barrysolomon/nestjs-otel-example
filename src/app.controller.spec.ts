import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { trace, context } from '@opentelemetry/api';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return "Hello World!" and trace active span', () => {
      const activeSpan = trace.getActiveSpan();
      const spy = jest.spyOn(appService, 'getHello').mockImplementation(() => 'Hello World!');

      expect(appController.getHello()).toBe('Hello World!');
      expect(spy).toHaveBeenCalled();
      
      if (activeSpan) {
        expect(activeSpan.setAttribute).toHaveBeenCalledWith('custom-tag', 'tag-value');
      }
    });
  });
});