FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
ENTRYPOINT ["node", "src/index.js"]

# Set default arguments
CMD []

# Document that the service uses stdin/stdout for communication
LABEL org.opencontainers.image.description="WebScraping.AI MCP Server - Model Context Protocol server for WebScraping.AI API"
LABEL org.opencontainers.image.source="https://github.com/webscraping-ai/webscraping-ai-mcp-server"
LABEL org.opencontainers.image.licenses="MIT"
