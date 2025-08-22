# Step 1: Base image with Node.js
FROM node:18-alpine

# Step 2: Set working directory
WORKDIR /usr/src/app

# Step 3: Install app dependencies
COPY package*.json ./
RUN npm install

# Step 4: Copy source code
COPY . .

# Step 5: Build the app (transpile TypeScript)
RUN npm run build

# Step 6: Expose the port NestJS runs on
EXPOSE 8081

# Step 7: Start the app
CMD ["node", "dist/main"]
