# WebScraping.AI MCP Server

A Model Context Protocol (MCP) server implementation that integrates with [WebScraping.AI](https://webscraping.ai) for web data extraction capabilities.

## Features

- Question answering about web page content
- Structured data extraction from web pages
- HTML content retrieval with JavaScript rendering
- Plain text extraction from web pages
- CSS selector-based content extraction
- Multiple proxy types (datacenter, residential) with country selection
- JavaScript rendering using headless Chrome/Chromium
- Concurrent request management with rate limiting
- Custom JavaScript execution on target pages
- Device emulation (desktop, mobile, tablet)
- Account usage monitoring

## Installation

### Running with npx

```bash
env WEBSCRAPING_AI_API_KEY=your_api_key npx -y webscraping-ai-mcp
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/webscraping-ai/webscraping-ai-mcp-server.git
cd webscraping-ai-mcp-server

# Install dependencies
npm install

# Run
npm start
```

### Configuring in Cursor
Note: Requires Cursor version 0.45.6+

The WebScraping.AI MCP server can be configured in two ways in Cursor:

1. **Project-specific Configuration** (recommended for team projects):
   Create a `.cursor/mcp.json` file in your project directory:
   ```json
   {
     "servers": {
       "webscraping-ai": {
         "type": "command",
         "command": "npx -y webscraping-ai-mcp",
         "env": {
           "WEBSCRAPING_AI_API_KEY": "your-api-key",
           "WEBSCRAPING_AI_CONCURRENCY_LIMIT": "5"
         }
       }
     }
   }
   ```

2. **Global Configuration** (for personal use across all projects):
   Create a `~/.cursor/mcp.json` file in your home directory with the same configuration format as above.

> If you are using Windows and are running into issues, try using `cmd /c "set WEBSCRAPING_AI_API_KEY=your-api-key && npx -y webscraping-ai-mcp"` as the command.

This configuration will make the WebScraping.AI tools available to Cursor's AI agent automatically when relevant for web scraping tasks.

### Running on Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-server-webscraping-ai": {
      "command": "npx",
      "args": ["-y", "webscraping-ai-mcp"],
      "env": {
        "WEBSCRAPING_AI_API_KEY": "YOUR_API_KEY_HERE",
        "WEBSCRAPING_AI_CONCURRENCY_LIMIT": "5"
      }
    }
  }
}
```

## Configuration

### Environment Variables

#### Required

- `WEBSCRAPING_AI_API_KEY`: Your WebScraping.AI API key
  - Required for all operations
  - Get your API key from [WebScraping.AI](https://webscraping.ai)

#### Optional Configuration
- `WEBSCRAPING_AI_CONCURRENCY_LIMIT`: Maximum number of concurrent requests (default: `5`)
- `WEBSCRAPING_AI_DEFAULT_PROXY_TYPE`: Type of proxy to use (default: `residential`)
- `WEBSCRAPING_AI_DEFAULT_JS_RENDERING`: Enable/disable JavaScript rendering (default: `true`)
- `WEBSCRAPING_AI_DEFAULT_TIMEOUT`: Maximum web page retrieval time in ms (default: `15000`, max: `30000`)
- `WEBSCRAPING_AI_DEFAULT_JS_TIMEOUT`: Maximum JavaScript rendering time in ms (default: `2000`)

### Configuration Examples

For standard usage:
```bash
# Required
export WEBSCRAPING_AI_API_KEY=your-api-key

# Optional - customize behavior (default values)
export WEBSCRAPING_AI_CONCURRENCY_LIMIT=5
export WEBSCRAPING_AI_DEFAULT_PROXY_TYPE=residential # datacenter or residential
export WEBSCRAPING_AI_DEFAULT_JS_RENDERING=true
export WEBSCRAPING_AI_DEFAULT_TIMEOUT=15000
export WEBSCRAPING_AI_DEFAULT_JS_TIMEOUT=2000
```

## Available Tools

### 1. Question Tool (`webscraping_ai_question`)

Ask questions about web page content.

```json
{
  "name": "webscraping_ai_question",
  "arguments": {
    "url": "https://example.com",
    "question": "What is the main topic of this page?",
    "timeout": 30000,
    "js": true,
    "js_timeout": 2000,
    "wait_for": ".content-loaded",
    "proxy": "datacenter",
    "country": "us"
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": "The main topic of this page is examples and documentation for HTML and web standards."
    }
  ],
  "isError": false
}
```

### 2. Fields Tool (`webscraping_ai_fields`)

Extract structured data from web pages based on instructions.

```json
{
  "name": "webscraping_ai_fields",
  "arguments": {
    "url": "https://example.com/product",
    "fields": {
      "title": "Extract the product title",
      "price": "Extract the product price",
      "description": "Extract the product description"
    },
    "js": true,
    "timeout": 30000
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "title": "Example Product",
        "price": "$99.99",
        "description": "This is an example product description."
      }
    }
  ],
  "isError": false
}
```

### 3. HTML Tool (`webscraping_ai_html`)

Get the full HTML of a web page with JavaScript rendering.

```json
{
  "name": "webscraping_ai_html",
  "arguments": {
    "url": "https://example.com",
    "js": true,
    "timeout": 30000,
    "wait_for": "#content-loaded"
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": "<html>...[full HTML content]...</html>"
    }
  ],
  "isError": false
}
```

### 4. Text Tool (`webscraping_ai_text`)

Extract the visible text content from a web page.

```json
{
  "name": "webscraping_ai_text",
  "arguments": {
    "url": "https://example.com",
    "js": true,
    "timeout": 30000
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Example Domain\nThis domain is for use in illustrative examples in documents..."
    }
  ],
  "isError": false
}
```

### 5. Selected Tool (`webscraping_ai_selected`)

Extract content from a specific element using a CSS selector.

```json
{
  "name": "webscraping_ai_selected",
  "arguments": {
    "url": "https://example.com",
    "selector": "div.main-content",
    "js": true,
    "timeout": 30000
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": "<div class=\"main-content\">This is the main content of the page.</div>"
    }
  ],
  "isError": false
}
```

### 6. Selected Multiple Tool (`webscraping_ai_selected_multiple`)

Extract content from multiple elements using CSS selectors.

```json
{
  "name": "webscraping_ai_selected_multiple",
  "arguments": {
    "url": "https://example.com",
    "selectors": ["div.header", "div.product-list", "div.footer"],
    "js": true,
    "timeout": 30000
  }
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": [
        "<div class=\"header\">Header content</div>",
        "<div class=\"product-list\">Product list content</div>",
        "<div class=\"footer\">Footer content</div>"
      ]
    }
  ],
  "isError": false
}
```

### 7. Account Tool (`webscraping_ai_account`)

Get information about your WebScraping.AI account.

```json
{
  "name": "webscraping_ai_account",
  "arguments": {}
}
```

Example response:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "requests": 5000,
        "remaining": 4500,
        "limit": 10000,
        "resets_at": "2023-12-31T23:59:59Z"
      }
    }
  ],
  "isError": false
}
```

## Common Options for All Tools

The following options can be used with all scraping tools:

- `timeout`: Maximum web page retrieval time in ms (15000 by default, maximum is 30000)
- `js`: Execute on-page JavaScript using a headless browser (true by default)
- `js_timeout`: Maximum JavaScript rendering time in ms (2000 by default)
- `wait_for`: CSS selector to wait for before returning the page content
- `proxy`: Type of proxy, datacenter or residential (residential by default)
- `country`: Country of the proxy to use (US by default). Supported countries: us, gb, de, it, fr, ca, es, ru, jp, kr, in
- `custom_proxy`: Your own proxy URL in "http://user:password@host:port" format
- `device`: Type of device emulation. Supported values: desktop, mobile, tablet
- `error_on_404`: Return error on 404 HTTP status on the target page (false by default)
- `error_on_redirect`: Return error on redirect on the target page (false by default)
- `js_script`: Custom JavaScript code to execute on the target page

## Error Handling

The server provides robust error handling:

- Automatic retries for transient errors
- Rate limit handling with backoff
- Detailed error messages
- Network resilience

Example error response:

```json
{
  "content": [
    {
      "type": "text",
      "text": "API Error: 429 Too Many Requests"
    }
  ],
  "isError": true
}
```

## Integration with LLMs

This server implements the [Model Context Protocol](https://github.com/facebookresearch/modelcontextprotocol), making it compatible with any MCP-enabled LLM platforms. You can configure your LLM to use these tools for web scraping tasks.

### Example: Configuring Claude with MCP

```javascript
const { Claude } = require('@anthropic-ai/sdk');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const claude = new Claude({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'webscraping-ai-mcp'],
  env: {
    WEBSCRAPING_AI_API_KEY: 'your-api-key'
  }
});

const client = new Client({
  name: 'claude-client',
  version: '1.0.0'
});

await client.connect(transport);

// Now you can use Claude with WebScraping.AI tools
const tools = await client.listTools();
const response = await claude.complete({
  prompt: 'What is the main topic of example.com?',
  tools: tools
});
```

## Development

```bash
# Clone the repository
git clone https://github.com/webscraping-ai/webscraping-ai-mcp-server.git
cd webscraping-ai-mcp-server

# Install dependencies
npm install

# Run tests
npm test

# Add your .env file
cp .env.example .env

# Start the inspector
npx @modelcontextprotocol/inspector node src/index.js
```

### Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

MIT License - see LICENSE file for details 
