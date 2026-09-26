#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';
import PQueue from 'p-queue';
import { ContentSanitizer, googleSearchUrl } from './lib.js';

dotenv.config();

// Environment variables
const WEBSCRAPING_AI_API_KEY = process.env.WEBSCRAPING_AI_API_KEY || '';
const WEBSCRAPING_AI_API_URL = process.env.WEBSCRAPING_AI_API_URL || 'https://api.webscraping.ai';
const CONCURRENCY_LIMIT = Number(process.env.WEBSCRAPING_AI_CONCURRENCY_LIMIT || 5);
const DEFAULT_PROXY_TYPE = process.env.WEBSCRAPING_AI_DEFAULT_PROXY_TYPE || 'residential';
const DEFAULT_JS_RENDERING = process.env.WEBSCRAPING_AI_DEFAULT_JS_RENDERING !== 'false';
const DEFAULT_TIMEOUT = Number(process.env.WEBSCRAPING_AI_DEFAULT_TIMEOUT || 15000);
const DEFAULT_JS_TIMEOUT = Number(process.env.WEBSCRAPING_AI_DEFAULT_JS_TIMEOUT || 2000);

// Validate required environment variables
if (!WEBSCRAPING_AI_API_KEY) {
  console.error('WEBSCRAPING_AI_API_KEY environment variable is required');
  process.exit(1);
}

class WebScrapingAIClient {
  constructor(options = {}) {
    const apiKey = options.apiKey || WEBSCRAPING_AI_API_KEY;
    const baseUrl = options.baseUrl || WEBSCRAPING_AI_API_URL;
    const timeout = options.timeout || 60000;
    const concurrency = options.concurrency || CONCURRENCY_LIMIT;

    if (!apiKey) {
      throw new Error('WebScraping.AI API key is required');
    }

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // The API reads repeated keys (selectors=h1&selectors=p); axios's default
      // selectors[]=... is silently ignored and /selected-multiple returns [[]].
      paramsSerializer: { indexes: null }
    });

    this.queue = new PQueue({ concurrency });
    this.apiKey = apiKey;
  }

  async request(endpoint, params) {
    try {
      return await this.queue.add(async () => {
        const response = await this.client.get(endpoint, { 
          params: {
            ...params,
            api_key: this.apiKey,
            from_mcp_server: true
          }
        });
        return response.data;
      });
    } catch (error) {
      const errorResponse = {
        message: 'API Error',
        status_code: error.response?.status,
        status_message: error.response?.statusText,
        body: error.response?.data
      };
      // The api_key rides in the query string; never let an error body or
      // message that echoes the request URL carry it back to the model.
      const text = JSON.stringify(errorResponse)
        .split(this.apiKey).join('[REDACTED]')
        .replace(/api_key=[^&\s"'\\]*/g, 'api_key=[REDACTED]');
      throw new Error(text);
    }
  }

  async question(url, question, options = {}) {
    return this.request('/ai/question', {
      url,
      question,
      ...options
    });
  }

  async fields(url, fields, options = {}) {
    return this.request('/ai/fields', {
      url,
      fields: JSON.stringify(fields),
      ...options
    });
  }

  async html(url, options = {}) {
    return this.request('/html', {
      url,
      ...options
    });
  }

  async text(url, options = {}) {
    return this.request('/text', {
      url,
      ...options
    });
  }

  async selected(url, selector, options = {}) {
    return this.request('/selected', {
      url,
      selector,
      ...options
    });
  }

  async selectedMultiple(url, selectors, options = {}) {
    return this.request('/selected-multiple', {
      url,
      selectors,
      ...options
    });
  }

  async serp(q, options = {}) {
    return this.request('/serp', {
      q,
      ...options
    });
  }

  // Only the tool's own params: /data ignores the scraping options.
  async data(url, options = {}) {
    return this.request('/data', {
      url,
      ...options
    });
  }

  async account() {
    return this.request('/account', {});
  }
}

// Re-exported for backwards compatibility; importing this module starts the server.
export { ContentSanitizer, googleSearchUrl };

// Create WebScrapingAI client
const client = new WebScrapingAIClient();

// Create content sanitizer
const sanitizer = new ContentSanitizer({
  enableContentSandboxing: process.env.WEBSCRAPING_AI_ENABLE_CONTENT_SANDBOXING === 'true'
});

// Helper function to process and format response
function createSanitizedResponse(content, url, isError = false) {
  if (isError) {
    return {
      content: [{ type: 'text', text: content }],
      isError: true
    };
  }

  // Process the content (apply sandboxing if enabled)
  const result = sanitizer.sanitize(content, { url });

  // Create response
  return {
    content: [{ type: 'text', text: result.content }]
  };
}

// Kept identical to the remote server's webscraping_ai_data tool (McpTools in the
// Rails app). Sites are examples only: the list grows server-side.
const DATA_TOOL_DESCRIPTION =
  'Get structured JSON for a public page on a supported site from its normal URL, e.g. a YouTube video, channel ' +
  'or playlist, a TikTok video or profile, an X post or profile, a LinkedIn company, job or profile, an Instagram ' +
  'post, reel or profile, or a Reddit post, subreddit or user. Returns {request_parameters: {url, provider, type}, ' +
  'parse_status, data}: provider (site) and type (page kind) are detected from the URL, parse_status is ok, ' +
  'parse_failed or not_found, and data holds snake_case fields whose shape depends on provider and type (null ' +
  "fields for values the page doesn't expose; data itself can be null when parsing fails). More sites are added " +
  'on the server over time: an unsupported URL or page type returns a 400 error, not charged, whose message ' +
  'lists what is supported. For other sites, use webscraping_ai_fields. Priced per site (see ' +
  'https://webscraping.ai/docs#data), including parse_failed and not_found results; failed fetches are not charged.';
const DATA_BLANK_URL_MESSAGE = 'url must be a non-empty URL';
const DATA_RESERVED_PARAMS_MESSAGE = 'params must not contain url or api_key';
const DATA_RESERVED_PARAM_KEYS = new Set(['url', 'api_key', 'key']);
const DATA_NAMED_PARAMS = new Set(['country', 'transcript', 'transcript_language', 'params', 'disable_content_sandboxing']);
const DATA_PARAM_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Same checks, order and messages as the remote server. Returns an error
// message, or null when every key is acceptable.
function dataParamsProblem(extra) {
  for (const key of Object.keys(extra)) {
    if (DATA_RESERVED_PARAM_KEYS.has(key)) return DATA_RESERVED_PARAMS_MESSAGE;
  }
  for (const key of Object.keys(extra)) {
    if (DATA_NAMED_PARAMS.has(key) || key.startsWith('from_')) {
      return `params must not repeat a named parameter: ${key}`;
    }
  }
  for (const key of Object.keys(extra)) {
    if (!DATA_PARAM_KEY_PATTERN.test(key)) return `params key is not allowed: ${key}`;
  }
  return null;
}

// Create MCP server
const server = new McpServer({
  name: 'WebScraping.AI MCP Server',
  version: '1.2.2'
});

// Tool metadata + annotations (MCP directory review criteria ask for them).
// No tool changes data on our side or the target's (spent credits are billing,
// not a destructive side effect); all but account reach the open web. Titles,
// descriptions and annotations match the remote server (app/services/mcp_tools.rb).
function toolConfig(title, description, inputSchema, openWorldHint = true) {
  return {
    title,
    description,
    inputSchema,
    annotations: { title, readOnlyHint: true, destructiveHint: false, openWorldHint }
  };
}

// Common options schema for all tools
const commonOptionsSchema = {
  timeout: z.number().optional().default(DEFAULT_TIMEOUT).describe(`Maximum web page retrieval time in ms (${DEFAULT_TIMEOUT} by default, maximum is 30000).`),
  js: z.boolean().optional().default(DEFAULT_JS_RENDERING).describe(`Execute on-page JavaScript using a headless browser (${DEFAULT_JS_RENDERING} by default).`),
  js_timeout: z.number().optional().default(DEFAULT_JS_TIMEOUT).describe(`Maximum JavaScript rendering time in ms (${DEFAULT_JS_TIMEOUT} by default).`),
  wait_for: z.string().optional().describe('CSS selector to wait for before returning the page content.'),
  proxy: z.enum(['datacenter', 'residential', 'stealth']).optional().default(DEFAULT_PROXY_TYPE).describe(`Type of proxy: datacenter, residential, or stealth (${DEFAULT_PROXY_TYPE} by default). Use residential if the site restricts datacenter traffic, or stealth for the most heavily protected sites with advanced anti-bot detection. Residential and stealth requests cost more than datacenter — see the pricing page.`),
  country: z.enum(['us', 'gb', 'de', 'it', 'fr', 'ca', 'es', 'ru', 'jp', 'kr', 'in', 'hk', 'tr']).optional().describe('Country of the proxy to use (US by default).'),
  custom_proxy: z.string().optional().describe('Your own proxy URL in "http://user:password@host:port" format.'),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional().describe('Type of device emulation.'),
  error_on_404: z.boolean().optional().describe('Return error on 404 HTTP status on the target page (false by default).'),
  error_on_redirect: z.boolean().optional().describe('Return error on redirect on the target page (false by default).'),
  js_script: z.string().optional().describe('Custom JavaScript code to execute on the target page.')
};

// Define and register tools
server.registerTool(
  'webscraping_ai_question',
  toolConfig(
    'Ask a Question About a Page',
    "Scrape a web page and have an LLM answer a question about it, using only the page's own content. Returns the answer as plain text. " +
      'If the page lacks the information or the question can\'t be answered from it, the tool returns an error result whose ' +
      'body.error starts with "Invalid page or question", and the credits are refunded. Costs 5 credits on top of the scrape\'s normal cost. ' +
      'Suited to a single fact or short answer; use webscraping_ai_fields for several named values at once, ' +
      'or webscraping_ai_text to read or reason over the whole page yourself. API docs: https://webscraping.ai/docs#ai-question',
    {
      url: z.string().describe('URL of the target page.'),
      question: z.string().describe('Question or instructions to ask the LLM model about the target page.'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, question, ...options }) => {
    try {
      const result = await client.question(url, question, options);
      return createSanitizedResponse(result, url);
    } catch (error) {
      return createSanitizedResponse(error.message, url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_fields',
  toolConfig(
    'Extract Fields from a Page',
    "Scrape a web page and have an LLM extract named values from it, using only the page's own content. " +
      'Returns JSON of the form {"result": {<field>: <value>}} with exactly the requested keys; each value is a string, ' +
      "or null when the page doesn't contain it. Values are never nested objects or arrays, so request a list as a single " +
      "delimited string. Costs 5 credits on top of the scrape's normal cost. API docs: https://webscraping.ai/docs#ai-fields",
    {
      url: z.string().describe('URL of the target page.'),
      fields: z.record(z.string()).describe('Dictionary of field names with instructions for extraction.'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, fields, ...options }) => {
    try {
      const result = await client.fields(url, fields, options);
      return createSanitizedResponse(JSON.stringify(result, null, 2), url);
    } catch (error) {
      return createSanitizedResponse(error.message, url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_html',
  toolConfig(
    'Get Page HTML',
    'Get the full rendered HTML of a web page (with JavaScript execution by default). API docs: https://webscraping.ai/docs#html',
    {
      url: z.string().describe('URL of the target page.'),
      return_script_result: z.boolean().optional().describe('Return result of the custom JavaScript code execution.'),
      format: z.enum(['json', 'text']).optional().describe('Response format (json or text).'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, return_script_result, format, ...options }) => {
    try {
      const result = await client.html(url, { ...options, return_script_result });
      const content = format === 'json' ? JSON.stringify({ html: result }) : result;
      return createSanitizedResponse(content, url);
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return createSanitizedResponse(JSON.stringify(errorObj), url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_text',
  toolConfig(
    'Get Page Text',
    "Get a web page's main content as Markdown, with boilerplate stripped and structure (headings, lists, tables, links) kept. " +
      'Best for reading a page or passing it to an LLM. API docs: https://webscraping.ai/docs#text',
    {
      url: z.string().describe('URL of the target page.'),
      text_format: z.enum(['plain', 'xml', 'json']).optional().default('json').describe('Format of the text response.'),
      return_links: z.boolean().optional().describe('Return links from the page body text.'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, text_format, return_links, ...options }) => {
    try {
      const result = await client.text(url, {
        ...options,
        text_format,
        return_links
      });

      const content = typeof result === 'object' ? JSON.stringify(result) : result;

      return createSanitizedResponse(content, url);
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return createSanitizedResponse(JSON.stringify(errorObj), url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_selected',
  toolConfig(
    'Get Selected Element HTML',
    'Get the HTML of the first page element matching a CSS selector. API docs: https://webscraping.ai/docs#selected',
    {
      url: z.string().describe('URL of the target page.'),
      selector: z.string().describe('CSS selector to extract content for.'),
      format: z.enum(['json', 'text']).optional().default('json').describe('Response format (json or text).'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, selector, format, ...options }) => {
    try {
      const result = await client.selected(url, selector, options);
      const content = format === 'json' ? JSON.stringify({ html: result }) : result;
      return createSanitizedResponse(content, url);
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return createSanitizedResponse(JSON.stringify(errorObj), url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_selected_multiple',
  toolConfig(
    'Get Multiple Selected Elements HTML',
    'Get the HTML of all page elements matching a list of CSS selectors. API docs: https://webscraping.ai/docs#selected',
    {
      url: z.string().describe('URL of the target page.'),
      selectors: z.array(z.string()).describe('Array of CSS selectors to extract content for.'),
      ...commonOptionsSchema
    }
  ),
  async ({ url, selectors, ...options }) => {
    try {
      const result = await client.selectedMultiple(url, selectors, options);
      return createSanitizedResponse(JSON.stringify(result, null, 2), url);
    } catch (error) {
      return createSanitizedResponse(error.message, url, true);
    }
  }
);

// No commonOptionsSchema: /serp ignores the scraping options (js, proxy, timeout...).
server.registerTool(
  'webscraping_ai_serp',
  toolConfig(
    'Search Google',
    'Search Google and get parsed results as JSON: organic_results (position, title, link, domain, displayed_link, ' +
      'snippet, date), related_searches, search_information (including spelling corrections) and pagination. ' +
      '10 results per page; position restarts at 1 on every page. Priced per search (see ' +
      'https://webscraping.ai/docs#serp); failed searches are not charged. Use it to find pages, then read them ' +
      'with webscraping_ai_text or the other tools.',
    {
      q: z.string().min(1).describe('Search query.'),
      engine: z.enum(['google']).optional().describe('Search engine to query (google by default).'),
      gl: z.string().optional().describe('Two-letter country code for the search, e.g. us, gb, de (us by default).'),
      hl: z.string().optional().describe('Two-letter language code for the results, e.g. en, de, fr (en by default).'),
      page: z.number().int().min(1).optional().describe('Results page number, 10 results per page (1 by default).')
    }
  ),
  async ({ q, ...options }) => {
    // minLength: 1 in the schema (kept identical to the remote server) still lets
    // whitespace through; reject it here with the same message the remote server uses.
    // q itself is sent untrimmed.
    if (q.trim() === '') {
      return createSanitizedResponse(JSON.stringify({ message: 'q must be a non-empty search query' }), null, true);
    }
    let source;
    try {
      // Inside the try: a lone surrogate makes encodeURIComponent throw "URI malformed".
      source = googleSearchUrl(q);
      const result = await client.serp(q, options);
      return createSanitizedResponse(JSON.stringify(result, null, 2), source);
    } catch (error) {
      return createSanitizedResponse(error.message, source, true);
    }
  }
);

// No commonOptionsSchema: /data ignores the scraping options (js, proxy, timeout...).
// The URL is never checked against a list of sites: supported sites grow on the
// server, and its free 400 is the source of truth for "unsupported".
server.registerTool(
  'webscraping_ai_data',
  toolConfig(
    'Get Structured Site Data',
    DATA_TOOL_DESCRIPTION,
    {
      url: z.string().min(1).describe(
        'Normal URL of a public page on a supported site, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ. ' +
          'Sent as-is; the site and page type are detected from it.'
      ),
      country: z.string().optional().describe(
        'Two-letter country code of the proxy used to fetch the page, e.g. us, gb, de (us by default).'
      ),
      transcript: z.boolean().optional().describe(
        "YouTube videos only. Also fetch the video's transcript into data.transcript (null when no matching captions " +
          'are available; false by default). If the transcript fetch fails, the whole request fails with a 500 and is ' +
          'not charged.'
      ),
      transcript_language: z.string().optional().describe(
        'YouTube videos only, with transcript: true. Caption language to pick, e.g. en, de. Without it, English is ' +
          'preferred, then the first available track; if the video has no captions in that language, data.transcript ' +
          'is null.'
      ),
      params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe(
        'Extra site-specific query parameters sent to the API as-is, as an object of string, number or boolean ' +
          'values, for parameters added after this tool was released. Must not contain url, api_key or the ' +
          'parameters above.'
      ),
      disable_content_sandboxing: z.boolean().optional().describe(
        'Return the raw result without the external-content security boundaries that guard against prompt ' +
          'injection (false by default).'
      )
    }
  ),
  async ({ url, params, disable_content_sandboxing, ...options }) => {
    // min(1) in the schema (kept identical to the remote server) still lets
    // whitespace through; reject it here with the same message the remote server uses.
    // url itself is sent untrimmed and otherwise unvalidated.
    if (url.trim() === '') {
      return createSanitizedResponse(JSON.stringify({ message: DATA_BLANK_URL_MESSAGE }), null, true);
    }
    const extra = params ?? {};
    const problem = dataParamsProblem(extra);
    if (problem) {
      return createSanitizedResponse(JSON.stringify({ message: problem }), url, true);
    }
    try {
      const result = await client.data(url, { ...extra, ...options });
      const text = JSON.stringify(result, null, 2);
      // Strict comparison: only a literal true drops the security boundaries.
      if (disable_content_sandboxing === true) return { content: [{ type: 'text', text }] };
      return createSanitizedResponse(text, url);
    } catch (error) {
      return createSanitizedResponse(error.message, url, true);
    }
  }
);

server.registerTool(
  'webscraping_ai_account',
  toolConfig(
    'Get Account Status',
    'Get your WebScraping.AI account status: email, remaining API credits, and concurrency. API docs: https://webscraping.ai/docs#account',
    {},
    false
  ),
  async () => {
    try {
      const result = await client.account();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true
      };
    }
  }
);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
}).catch(err => {
  console.error('Failed to connect to transport:', err);
  process.exit(1);
});
