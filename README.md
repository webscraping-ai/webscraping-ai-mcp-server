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

### Running on Cursor

Configuring Cursor 🖥️
Note: Requires Cursor version 0.45.6+

To configure WebScraping.AI MCP in Cursor:

1. Open Cursor Settings
2. Go to Features > MCP Servers 
3. Click "+ Add New MCP Server"
4. Enter the following:
   - Name: "webscraping-ai-mcp" (or your preferred name)
   - Type: "command"
   - Command: `env WEBSCRAPING_AI_API_KEY=your-api-key npx -y webscraping-ai-mcp`

> If you are using Windows and are running into issues, try `cmd /c "set WEBSCRAPING_AI_API_KEY=your-api-key && npx -y webscraping-ai-mcp"`

Replace `your-api-key` with your WebScraping.AI API key.

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

##### Concurrency Configuration

- `WEBSCRAPING_AI_CONCURRENCY_LIMIT`: Maximum number of concurrent requests (default: `5`)

### Configuration Examples

For standard usage with custom concurrency setting:

```bash
# Required
export WEBSCRAPING_AI_API_KEY=your-api-key
# Optional
export WEBSCRAPING_AI_CONCURRENCY_LIMIT=10        # Increase concurrency limit
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
// Example code for connecting Claude with the WebScraping.AI MCP Server
const { Claude } = require('@anthropic-ai/sdk');
const { McpClient } = require('@modelcontextprotocol/sdk/client');

const claude = new Claude({
  apiKey: 'your_claude_api_key'
});

const mcpClient = new McpClient({
  baseUrl: 'http://localhost:3000/sse'
});

// Now you can use Claude with WebScraping.AI tools
const response = await claude.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1000,
  system: 'You have access to WebScraping.AI tools for web data extraction.',
  messages: [
    { role: 'user', content: 'Extract the main heading from https://example.com' }
  ],
  tools: await mcpClient.listTools()
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
