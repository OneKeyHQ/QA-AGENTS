import { createWorker } from 'tesseract.js';

export default class OcrService {
  before(capabilities) {
    browser.addCommand(
      'ocr',
      async (language = 'eng+chi_sim', rectangle = null) => {
        const worker = await createWorker(language);
        const base64Image = await browser.takeScreenshot();
        console.log(rectangle);

        const {
          data: { text },
        } = await worker.recognize(`data:image/png;base64,${base64Image}`, {
          rectangle,
        });
        console.log(text);
        await worker.terminate();
        return text;
      },
    );
  }
}
