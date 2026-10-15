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
