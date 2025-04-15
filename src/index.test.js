import {
  describe,
  expect,
  jest,
  test,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Create mock WebScrapingAIClient
class MockWebScrapingAIClient {
  constructor() {
    this.question = jest.fn().mockResolvedValue('This is the answer to your question.');
    this.fields = jest.fn().mockResolvedValue({ field1: 'value1', field2: 'value2' });
    this.html = jest.fn().mockResolvedValue('<html><body>Test HTML Content</body></html>');
    this.text = jest.fn().mockResolvedValue('Test text content');
    this.selected = jest.fn().mockResolvedValue('<div>Selected Element</div>');
    this.selectedMultiple = jest.fn().mockResolvedValue(['<div>Element 1</div>', '<div>Element 2</div>']);
    this.account = jest.fn().mockResolvedValue({ requests: 100, remaining: 900, limit: 1000 });
  }
}

// Test interfaces
class RequestContext {
  constructor(toolName, args) {
    this.params = {
      name: toolName,
      arguments: args
    };
  }
}

describe('WebScraping.AI MCP Server Tests', () => {
  let mockClient;
  let requestHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new MockWebScrapingAIClient();

    // Create request handler function
    requestHandler = async (request) => {
      const { name: toolName, arguments: args } = request.params;
      if (!args && toolName !== 'webscraping_ai_account') {
        throw new Error('No arguments provided');
      }
      return handleRequest(toolName, args || {}, mockClient);
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test question functionality
  test('should handle question request', async () => {
    const url = 'https://example.com';
    const question = 'What is on this page?';

    const response = await requestHandler(
      new RequestContext('webscraping_ai_question', { url, question })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: 'This is the answer to your question.' }],
      isError: false
    });
    expect(mockClient.question).toHaveBeenCalledWith(url, question, {});
  });

  // Test fields functionality
  test('should handle fields request', async () => {
    const url = 'https://example.com';
    const fields = { 
      title: 'Extract the title', 
      price: 'Extract the price' 
    };

    const response = await requestHandler(
      new RequestContext('webscraping_ai_fields', { url, fields })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: JSON.stringify({ field1: 'value1', field2: 'value2' }, null, 2) }],
      isError: false
    });
    expect(mockClient.fields).toHaveBeenCalledWith(url, fields, {});
  });

  // Test html functionality
  test('should handle html request', async () => {
    const url = 'https://example.com';

    const response = await requestHandler(
      new RequestContext('webscraping_ai_html', { url })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: '<html><body>Test HTML Content</body></html>' }],
      isError: false
    });
    expect(mockClient.html).toHaveBeenCalledWith(url, {});
  });

  // Test text functionality
  test('should handle text request', async () => {
    const url = 'https://example.com';

    const response = await requestHandler(
      new RequestContext('webscraping_ai_text', { url })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: 'Test text content' }],
      isError: false
    });
    expect(mockClient.text).toHaveBeenCalledWith(url, {});
  });

  // Test selected functionality
  test('should handle selected request', async () => {
    const url = 'https://example.com';
    const selector = '.main-content';

    const response = await requestHandler(
      new RequestContext('webscraping_ai_selected', { url, selector })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: '<div>Selected Element</div>' }],
      isError: false
    });
    expect(mockClient.selected).toHaveBeenCalledWith(url, selector, {});
  });

  // Test selected_multiple functionality
  test('should handle selected_multiple request', async () => {
    const url = 'https://example.com';
    const selectors = ['.item1', '.item2'];

    const response = await requestHandler(
      new RequestContext('webscraping_ai_selected_multiple', { url, selectors })
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: JSON.stringify(['<div>Element 1</div>', '<div>Element 2</div>'], null, 2) }],
      isError: false
    });
    expect(mockClient.selectedMultiple).toHaveBeenCalledWith(url, selectors, {});
  });

  // Test account functionality
  test('should handle account request', async () => {
    const response = await requestHandler(
      new RequestContext('webscraping_ai_account', {})
    );

    expect(response).toEqual({
      content: [{ type: 'text', text: JSON.stringify({ requests: 100, remaining: 900, limit: 1000 }, null, 2) }],
      isError: false
    });
    expect(mockClient.account).toHaveBeenCalled();
  });

  // Test error handling
  test('should handle API errors', async () => {
    const url = 'https://example.com';
    mockClient.question.mockRejectedValueOnce(new Error('API Error'));

    const response = await requestHandler(
      new RequestContext('webscraping_ai_question', { url, question: 'What is on this page?' })
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('API Error');
  });

  // Test unknown tool
  test('should handle unknown tool request', async () => {
    const response = await requestHandler(
      new RequestContext('unknown_tool', { some: 'args' })
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Unknown tool');
  });
});

// Helper function to simulate request handling
async function handleRequest(name, args, client) {
  try {
    const options = { ...args };
    
    // Remove required parameters from options for each tool type
    switch (name) {
      case 'webscraping_ai_question': {
        const { url, question, ...rest } = options;
        if (!url || !question) {
          throw new Error('URL and question are required');
        }
        
        const result = await client.question(url, question, rest);
        return {
          content: [{ type: 'text', text: result }],
          isError: false
        };
      }

      case 'webscraping_ai_fields': {
        const { url, fields, ...rest } = options;
        if (!url || !fields) {
          throw new Error('URL and fields are required');
        }
        
        const result = await client.fields(url, fields, rest);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      case 'webscraping_ai_html': {
        const { url, ...rest } = options;
        if (!url) {
          throw new Error('URL is required');
        }
        
        const result = await client.html(url, rest);
        return {
          content: [{ type: 'text', text: result }],
          isError: false
        };
      }

      case 'webscraping_ai_text': {
        const { url, ...rest } = options;
        if (!url) {
          throw new Error('URL is required');
        }
        
        const result = await client.text(url, rest);
        return {
          content: [{ type: 'text', text: result }],
          isError: false
        };
      }

      case 'webscraping_ai_selected': {
        const { url, selector, ...rest } = options;
        if (!url || !selector) {
          throw new Error('URL and selector are required');
        }
        
        const result = await client.selected(url, selector, rest);
        return {
          content: [{ type: 'text', text: result }],
          isError: false
        };
      }

      case 'webscraping_ai_selected_multiple': {
        const { url, selectors, ...rest } = options;
        if (!url || !selectors) {
          throw new Error('URL and selectors are required');
        }
        
        const result = await client.selectedMultiple(url, selectors, rest);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      case 'webscraping_ai_account': {
        const result = await client.account();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: error.message }],
      isError: true
    };
  }
} 