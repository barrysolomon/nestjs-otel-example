# Use official Node.js image as a base
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Build the NestJS application
RUN npm run build

# Create a volume for persistent storage
VOLUME ["/usr/src/app/data"]

# Set environment variables for storage
ENV LOG_STORAGE_PATH="/usr/src/app/data/logs-storage.json" \
    TRACE_STORAGE_PATH="/usr/src/app/data/traces-storage.json"

# Create the data directory
RUN mkdir -p /usr/src/app/data

# Expose port
EXPOSE 3000

# Command to run the app
CMD ["node", "dist/main"]
# CMD ["node", "dist/main", "-r", "@lumigo/opentelemetry"]
