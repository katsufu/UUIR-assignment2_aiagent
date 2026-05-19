FROM node:20-slim

WORKDIR /app

# Copy dependency configurations
COPY package*.json ./

# Install all dependencies required for runtime execution via tsx
RUN npm install

# Copy application assets and logic layers
COPY . .

# Ensure standard runtime port configuration targeting Hugging Face Spaces standard
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

# Launch server via memory-optimized native TS execution driver
CMD ["npx", "tsx", "src/server.ts"]
