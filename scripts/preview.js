import { options } from './options.js';
import { loadConfig } from '../src/build/config.js';
import { serve } from './server.js';

const values = options();
const config = await loadConfig(process.cwd(), { basePath: values.base });
serve({ directory: values.out, port: values.port, host: values.host, basePath: config.basePath });
