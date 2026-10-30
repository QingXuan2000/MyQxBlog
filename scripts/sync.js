/* 手动同步入口。工作流里调的是同一个函数，走的判断一条不少。
   环境变量从 process.env 读，本地跑之前记得先 export。 */
import { syncDiscussions } from '../src/content/github.js';

try {
  const result = await syncDiscussions();
  console.log('Discussions synchronized.', result);
} catch (error) {
  console.error(`Sync failed: ${error.message}`);
  process.exitCode = 1;
}
