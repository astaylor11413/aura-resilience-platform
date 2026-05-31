# Use an optimized, official light-weight base image
FROM python:3.11-slim

# Prevent Python from writing pyc files to disk and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for libraries like SciPy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements matrix
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the server engine files into the container space
COPY . /app/

# Expose the designated internal routing engine port
EXPOSE 8000

# Fire up Gunicorn as the WSGI worker server
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "app:app"]