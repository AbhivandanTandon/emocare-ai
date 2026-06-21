# Use official lightweight Python image matching the runtime version
FROM python:3.11-slim

# Install system dependencies (ffmpeg and libsndfile are critical for audio processing)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy Python requirements first to leverage Docker cache
COPY backend/requirements.txt ./backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy all project files into the container
COPY backend/ /app/backend/
COPY scripts/ /app/scripts/
COPY runtime.txt /app/

# Make the startup script executable
RUN chmod +x /app/scripts/startup.sh

# Expose port 7860 (Hugging Face Spaces default container port)
EXPOSE 7860

# Set environment variables
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

# Start the application using the startup shell script
CMD ["/app/scripts/startup.sh"]
