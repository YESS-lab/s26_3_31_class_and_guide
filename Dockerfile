FROM node:22

# Install git (Claude Code requires it) and Claude Code CLI
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --no-package-lock

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Initialize a git repo (Claude Code expects to run inside a git repo)
RUN git init && git add -A && git commit -m "docker build" --allow-empty

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server (serves built frontend from dist/)
CMD ["npx", "tsx", "server/server.ts"]
