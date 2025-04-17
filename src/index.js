#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';
import PQueue from 'p-queue';

dotenv.config();

// Environment variables
const WEBSCRAPING_AI_API_KEY = process.env.WEBSCRAPING_AI_API_KEY || '';
const WEBSCRAPING_AI_API_URL = 'https://api.webscraping.ai';
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
      }
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
      throw new Error(JSON.stringify(errorResponse));
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

  async account() {
    return this.request('/account', {});
  }
}

// Create WebScrapingAI client
const client = new WebScrapingAIClient();

// Create MCP server
const server = new McpServer({
  name: 'WebScraping.AI MCP Server',
  version: '1.0.1'
});

// Common options schema for all tools
const commonOptionsSchema = {
  timeout: z.number().optional().default(DEFAULT_TIMEOUT).describe(`Maximum web page retrieval time in ms (${DEFAULT_TIMEOUT} by default, maximum is 30000).`),
  js: z.boolean().optional().default(DEFAULT_JS_RENDERING).describe(`Execute on-page JavaScript using a headless browser (${DEFAULT_JS_RENDERING} by default).`),
  js_timeout: z.number().optional().default(DEFAULT_JS_TIMEOUT).describe(`Maximum JavaScript rendering time in ms (${DEFAULT_JS_TIMEOUT} by default).`),
  wait_for: z.string().optional().describe('CSS selector to wait for before returning the page content.'),
  proxy: z.enum(['datacenter', 'residential']).optional().default(DEFAULT_PROXY_TYPE).describe(`Type of proxy, datacenter or residential (${DEFAULT_PROXY_TYPE} by default).`),
  country: z.enum(['us', 'gb', 'de', 'it', 'fr', 'ca', 'es', 'ru', 'jp', 'kr', 'in']).optional().describe('Country of the proxy to use (US by default).'),
  custom_proxy: z.string().optional().describe('Your own proxy URL in "http://user:password@host:port" format.'),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional().describe('Type of device emulation.'),
  error_on_404: z.boolean().optional().describe('Return error on 404 HTTP status on the target page (false by default).'),
  error_on_redirect: z.boolean().optional().describe('Return error on redirect on the target page (false by default).'),
  js_script: z.string().optional().describe('Custom JavaScript code to execute on the target page.')
};

// Define and register tools
server.tool(
  'webscraping_ai_question',
  {
    url: z.string().describe('URL of the target page.'),
    question: z.string().describe('Question or instructions to ask the LLM model about the target page.'),
    ...commonOptionsSchema
  },
  async ({ url, question, ...options }) => {
    try {
      const result = await client.question(url, question, options);
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true
      };
    }
  }
);

server.tool(
  'webscraping_ai_fields',
  {
    url: z.string().describe('URL of the target page.'),
    fields: z.record(z.string()).describe('Dictionary of field names with instructions for extraction.'),
    ...commonOptionsSchema
  },
  async ({ url, fields, ...options }) => {
    try {
      const result = await client.fields(url, fields, options);
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

server.tool(
  'webscraping_ai_html',
  {
    url: z.string().describe('URL of the target page.'),
    return_script_result: z.boolean().optional().describe('Return result of the custom JavaScript code execution.'),
    format: z.enum(['json', 'text']).optional().describe('Response format (json or text).'),
    ...commonOptionsSchema
  },
  async ({ url, return_script_result, format, ...options }) => {
    try {
      const result = await client.html(url, { ...options, return_script_result });
      if (format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ html: result }) }]
        };
      }
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return {
        content: [{ type: 'text', text: JSON.stringify(errorObj) }],
        isError: true
      };
    }
  }
);

server.tool(
  'webscraping_ai_text',
  {
    url: z.string().describe('URL of the target page.'),
    text_format: z.enum(['plain', 'xml', 'json']).optional().default('json').describe('Format of the text response.'),
    return_links: z.boolean().optional().describe('Return links from the page body text.'),
    ...commonOptionsSchema
  },
  async ({ url, text_format, return_links, ...options }) => {
    try {
      const result = await client.text(url, { 
        ...options, 
        text_format, 
        return_links 
      });
      return {
        content: [{ type: 'text', text: typeof result === 'object' ? JSON.stringify(result) : result }]
      };
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return {
        content: [{ type: 'text', text: JSON.stringify(errorObj) }],
        isError: true
      };
    }
  }
);

server.tool(
  'webscraping_ai_selected',
  {
    url: z.string().describe('URL of the target page.'),
    selector: z.string().describe('CSS selector to extract content for.'),
    format: z.enum(['json', 'text']).optional().default('json').describe('Response format (json or text).'),
    ...commonOptionsSchema
  },
  async ({ url, selector, format, ...options }) => {
    try {
      const result = await client.selected(url, selector, options);
      if (format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ html: result }) }]
        };
      }
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      const errorObj = JSON.parse(error.message);
      return {
        content: [{ type: 'text', text: JSON.stringify(errorObj) }],
        isError: true
      };
    }
  }
);

server.tool(
  'webscraping_ai_selected_multiple',
  {
    url: z.string().describe('URL of the target page.'),
    selectors: z.array(z.string()).describe('Array of CSS selectors to extract content for.'),
    ...commonOptionsSchema
  },
  async ({ url, selectors, ...options }) => {
    try {
      const result = await client.selectedMultiple(url, selectors, options);
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

server.tool(
  'webscraping_ai_account',
  {},
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
