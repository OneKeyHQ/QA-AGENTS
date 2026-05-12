import { createWorker } from 'tesseract.js';

(async () => {
  const worker = await createWorker('chi_sim');
  const ret = await worker.recognize('./rotated_picture.jpg');
  ret.data.words.forEach((element) => {
    console.log(element.text);
  });
  await worker.terminate();
})();
