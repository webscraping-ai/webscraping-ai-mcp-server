// End-to-end: spawns the real server (src/index.js) over stdio with the MCP SDK
// client, pointed at a local HTTP stub that records every request.
import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), 'index.js');
const API_KEY = 'test-key';

const SERP_BODY = {
  search_parameters: { q: 'coffee machines' },
  organic_results: [
    { position: 1, title: 'Result', link: 'https://example.com' },
  ],
};

describe('stdio server against a local API stub', () => {
  let stub;
  let client;
  const requests = [];

  beforeAll(async () => {
    stub = http.createServer((req, res) => {
      requests.push(req.url);
      const path = new URL(req.url, 'http://stub').pathname;
      res.setHeader('Content-Type', 'application/json');
      if (path === '/serp') res.end(JSON.stringify(SERP_BODY));
      else if (path === '/selected-multiple')
        res.end(JSON.stringify([['<h1>Title</h1>'], ['<p>Body</p>']]));
      else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'not found' }));
      }
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      // Outside the repo so the server's dotenv.config() can't pick up a local .env.
      cwd: os.tmpdir(),
      env: {
        ...getDefaultEnvironment(),
        WEBSCRAPING_AI_API_KEY: API_KEY,
        WEBSCRAPING_AI_API_URL: `http://127.0.0.1:${stub.address().port}`,
      },
      stderr: 'ignore',
    });
    client = new Client({
      name: 'webscraping-ai-stdio-test',
      version: '1.0.0',
    });
    await client.connect(transport);
  }, 20000);

  afterAll(async () => {
    await client?.close();
    await new Promise((r) => (stub ? stub.close(r) : r()));
  });

  const lastRequest = () =>
    new URL(requests[requests.length - 1], 'http://stub');

  test('lists all 8 tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'webscraping_ai_account',
      'webscraping_ai_fields',
      'webscraping_ai_html',
      'webscraping_ai_question',
      'webscraping_ai_selected',
      'webscraping_ai_selected_multiple',
      'webscraping_ai_serp',
      'webscraping_ai_text',
    ]);
    const serp = tools.find((t) => t.name === 'webscraping_ai_serp');
    expect(serp.inputSchema.properties.q.minLength).toBe(1);
  });

  test('serp sends exactly q, gl, page, api_key and from_mcp_server', async () => {
    const before = requests.length;
    const result = await client.callTool({
      name: 'webscraping_ai_serp',
      arguments: { q: 'coffee machines', gl: 'de', page: 2 },
    });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(SERP_BODY);
    expect(requests.length).toBe(before + 1);
    const url = lastRequest();
    expect(url.pathname).toBe('/serp');
    expect([...url.searchParams.keys()].sort()).toEqual([
      'api_key',
      'from_mcp_server',
      'gl',
      'page',
      'q',
    ]);
    expect(url.searchParams.get('q')).toBe('coffee machines');
    expect(url.searchParams.get('gl')).toBe('de');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('api_key')).toBe(API_KEY);
    expect(url.searchParams.get('from_mcp_server')).toBe('true');
    for (const key of ['js', 'proxy', 'timeout'])
      expect(url.searchParams.has(key)).toBe(false);
  });

  test('serp rejects an empty q via the schema without calling the API', async () => {
    const before = requests.length;
    let outcome;
    try {
      outcome = await client.callTool({
        name: 'webscraping_ai_serp',
        arguments: { q: '' },
      });
    } catch (err) {
      outcome = err;
    }
    // Depending on the SDK version the validation failure is a thrown McpError or an isError result.
    const text =
      outcome instanceof Error ? outcome.message : outcome.content[0].text;
    if (!(outcome instanceof Error)) expect(outcome.isError).toBe(true);
    expect(text).toMatch(/invalid/i);
    expect(requests.length).toBe(before);
  });

  test('serp rejects a whitespace-only q with the shared error message', async () => {
    const before = requests.length;
    const result = await client.callTool({
      name: 'webscraping_ai_serp',
      arguments: { q: ' \t\n ' },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      message: 'q must be a non-empty search query',
    });
    expect(requests.length).toBe(before);
  });

  test('serp returns an error result (not a crash) for a lone surrogate', async () => {
    const result = await client.callTool({
      name: 'webscraping_ai_serp',
      arguments: { q: 'bad \uD800 query' },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/URI malformed/);
  });

  test('selected_multiple sends selectors as repeated keys', async () => {
    const result = await client.callTool({
      name: 'webscraping_ai_selected_multiple',
      arguments: { url: 'https://example.com', selectors: ['h1', 'p'] },
    });

    expect(result.isError).toBeUndefined();
    const url = lastRequest();
    expect(url.pathname).toBe('/selected-multiple');
    expect(url.search).toContain('selectors=h1&selectors=p');
    expect(url.searchParams.getAll('selectors')).toEqual(['h1', 'p']);
    expect(url.search).not.toContain('selectors%5B%5D');
  });
});
