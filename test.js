import { translate } from './src/translate.js';

(async () => {
  const result = await translate('how are you?', 'en', 'zh', { printResult: true });
  console.log(result);
})();
