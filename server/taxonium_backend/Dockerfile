# Use the official Node.js 16 Alpine image as the base image
FROM node:16-alpine

# FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app
# Ensure destination directories exist before copying

# RUN mkdir -p taxonium_backend taxonium_data_handling

COPY ./taxonium_backend/ ./taxonium_backend/

COPY ./taxonium_data_handling/ ./taxonium_data_handling/

# Copy the package.json and package-lock.json (if available) to the container to install dependencies
COPY taxonium_backend/package.json taxonium_backend/package.json

# Install the app dependencies

WORKDIR /app/taxonium_backend

RUN npm install

# Copy the rest of the application code into the container
# Expose the port that your app will run on (8080 in this case)
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]
# CMD ["python3", "-m", "http.server", "8080"]
