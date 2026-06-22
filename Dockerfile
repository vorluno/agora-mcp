# MCP server image for agora — used by Glama to verify the server starts
# and responds to MCP introspection (tools/list) over stdio.
FROM oven/bun:1

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the source
COPY src ./src

# The MCP server speaks JSON-RPC over stdio
CMD ["bun", "run", "src/index.ts"]
