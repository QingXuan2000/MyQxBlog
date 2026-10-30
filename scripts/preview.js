/* 只做预览，不重新构建。产物得先用 npm run build 生成好。
   配置照样读一遍，是为了拿到 basePath，否则带前缀的站点会全站 404。 */
import { options } from './options.js';
import { loadConfig } from '../src/build/config.js';
import { serve } from './server.js';

const values = options();
const config = await loadConfig(process.cwd(), { basePath: values.base });
serve({ directory: values.out, port: values.port, host: values.host, basePath: config.basePath });
