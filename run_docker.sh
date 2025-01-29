#!/bin/bash

# Build the Docker image
echo "Building the Docker image..."
docker build -t aruna-app .

# Run the Docker container
echo "Running the Docker container..."
docker run -p 8501:8501 --name aruna-app-container aruna-app
