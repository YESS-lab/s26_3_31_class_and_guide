FROM node:22

WORKDIR /app

# Install dependencies (--no-optional avoids platform-specific rollup bug,
# then install rollup platform binaries explicitly)
COPY package.json package-lock.json ./
RUN npm install --no-package-lock

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
