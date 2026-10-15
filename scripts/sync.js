import { syncDiscussions } from '../src/content/github.js';

try {
  const result = await syncDiscussions();
  console.log('Discussions synchronized.', result);
} catch (error) {
  console.error(`Sync failed: ${error.message}`);
  process.exitCode = 1;
}
