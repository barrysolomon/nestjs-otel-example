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

# Expose port
EXPOSE 3000

# Command to run the app
CMD ["node", "dist/main"]
# CMD ["node", "dist/main", "-r", "@lumigo/opentelemetry"]
