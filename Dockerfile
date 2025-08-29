# Step 1: Base image with Node.js
FROM node:18-alpine

# Instala dependências básicas do sistema (para pdf-lib, Puppeteer, etc.)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    git \
    && rm -rf /var/cache/apk/*

# Define variáveis para o Puppeteer usar o Chromium instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Step 2: Set working directory
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json
COPY package*.json ./

# Step 4: Install app dependencies without tentar compilar canvas
RUN npm install --legacy-peer-deps

# Step 5: Copy source code
COPY . .

# Step 6: Build the app (TypeScript → JavaScript)
RUN npm run build

# Step 7: Expose the port NestJS runs on
EXPOSE 8081

# Step 8: Start the app
CMD ["dumb-init", "node", "dist/main.js"]
