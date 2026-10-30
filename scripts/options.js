/* build / dev / preview 共用的一套命令行参数。
   buildOptions 负责把 CLI 名字换成 buildSite 认识的参数名，两边的命名不再各说各话。 */
import { parseArgs } from 'node:util';

export function options() {
  return parseArgs({
    options: {
      out: { type: 'string', default: 'dist' },
      content: { type: 'string' },
      base: { type: 'string' },
      port: { type: 'string', default: '5502' },
      host: { type: 'string', default: '127.0.0.1' },
      drafts: { type: 'boolean', default: false },
    },
  }).values;
}

export function buildOptions(values) {
  return {
    outDir: values.out,
    contentDir: values.content,
    basePath: values.base,
    includeDrafts: values.drafts,
  };
}
