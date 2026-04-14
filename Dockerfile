FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server (serves built frontend from dist/)
CMD ["npx", "tsx", "server/server.ts"]
