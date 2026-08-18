import { createApp } from './app/create-app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = createApp(env.forceFailure);

app.listen(env.port, env.host, () => console.log(`Dynamics mock listening on http://${env.host}:${env.port}`));
