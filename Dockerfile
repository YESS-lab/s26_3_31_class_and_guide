FROM node:22

# Install Claude Code CLI globally (the Agent SDK spawns it as a subprocess)
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user with known UID
# (Claude Code blocks --dangerously-skip-permissions as root)
RUN useradd -m -u 1001 -s /bin/bash agent

WORKDIR /home/agent/app

# Install dependencies as root (faster, then chown later)
COPY package.json package-lock.json ./
RUN npm install --no-package-lock

# Copy source (including .claude/skills/, CLAUDE.md, agent-config.json)
COPY . .

# Build frontend
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Set ownership of everything to agent user
RUN chown -R agent:agent /home/agent

# Switch to non-root user
USER agent

# Configure git for agent user (Claude Code expects a git repo)
RUN git config --global user.email "rocky-bot@erid.net" && \
    git config --global user.name "Rocky Bot" && \
    git config --global --add safe.directory /home/agent/app && \
    git init && git add -A && git commit -m "docker build"

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server
CMD ["npx", "tsx", "server/server.ts"]
