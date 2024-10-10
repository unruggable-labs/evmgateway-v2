import { USER_CONFIG } from '../src/environment.js';
import { configureAdapter } from '../src/server-adapter.js';

const adapter = await configureAdapter(USER_CONFIG);

Bun.serve({
  fetch: (request) => {
    return adapter(request);
  },
  port: USER_CONFIG.PORT,
});
