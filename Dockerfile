FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies needed for Puppeteer (for PDF generation)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip downloading Chrome and use the installed one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Create necessary directories that will be mounted as persistent volumes
RUN mkdir -p data config output reports

# Expose port
EXPOSE 3773

# Start the application
CMD ["npm", "start"]
