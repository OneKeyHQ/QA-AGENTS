import WorkerService from '../services/composer.service.js';
import OcrService from '../services/ocr.service.js';
import StoreService from '../services/store.service.js';

export const loadService = () => {
  const worker = new WorkerService();
  worker.beforeTest();
  const ocrService = new OcrService();
  ocrService.before();
  const storeService = new StoreService();
  storeService.beforeTest();
};
