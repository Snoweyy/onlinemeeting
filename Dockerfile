FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create required directories
RUN mkdir -p uploads logs

# Copy app source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S musicroom -u 1001 -G nodejs

# Change ownership of directories
RUN chown -R musicroom:nodejs /usr/src/app/uploads && \
    chown -R musicroom:nodejs /usr/src/app/logs

# Switch to non-root user
USER musicroom

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD [ "npm", "start" ]
