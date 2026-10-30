/* 构建入口。参数解析、异常兜底都留在这里，真正的逻辑在 src/build/site.js。
   出错只设 exitCode 不抛栈，CI 日志里看到的应该是能读的一句话。 */
import { buildSite } from '../src/build/site.js';
import { options, buildOptions } from './options.js';

try {
  const result = await buildSite(buildOptions(options()));
  console.log(
    `Built ${result.postCount} articles and ${result.pageCount} pages → ${result.outDir}`,
  );
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
