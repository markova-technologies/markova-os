# @markova/sdk

Minimal Node.js client for the Markova `/v1` API (auth, keys, agents, calls, numbers).

```js
const { Markova } = require('@markova/sdk');

const client = new Markova({ baseUrl: 'http://localhost:8000' });

await client.register({
  name: 'Ada',
  companyName: 'Ada Co',
  email: 'ada@example.com',
  password: 'SecurePass1',
});

await client.login({ email: 'ada@example.com', password: 'SecurePass1' });

const key = await client.createKey({ name: 'sandbox', environment: 'test' });
client.setApiKey(key.api_key);

const agent = await client.createAgent({
  name: 'Almaz',
  prompt: 'You are a helpful Amharic voice agent.',
  language: 'am',
  voice_config: { provider: 'edge', voice_id: 'am-ET-MekdesNeural' },
  model_config: { provider: 'groq', model_id: 'llama-3.3-70b-versatile' },
});

await client.testCall(agent.id, { to_number: '+251911000000' });
```

Full contract: repo-root `openapi.yaml` (also served at `GET /docs` on the gateway).
