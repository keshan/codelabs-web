# Use an official Python runtime as a parent image
# Using slim-bullseye for a smaller image size
FROM python:3.11-slim-bullseye

# Set environment variables
# Prevents Python from writing pyc files to disc (improves performance in containers)
ENV PYTHONDONTWRITEBYTECODE 1
# Ensures Python output is sent straight to the terminal without being buffered
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for certain Python packages)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Copy only requirements.txt first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port the app runs on
# This should match the port used by uvicorn
EXPOSE 8080

# Define the command to run the application
# Use the standard uvicorn command for production
# Note: Cloud Run automatically injects the PORT environment variable, 
# but we specify 8080 as a default and it's common practice.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
