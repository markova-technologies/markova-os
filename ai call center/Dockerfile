FROM python:3.10-slim

# Install ffmpeg for audio processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Expose port (Render sets PORT environment variable, usually 10000)
EXPOSE 10000

# Start command
CMD ["uvicorn", "main_natural_voice:app", "--host", "0.0.0.0", "--port", "10000"]
