# Use an optimized, official light-weight base image
FROM python:3.11-slim

# Prevent Python from writing pyc files to disk and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements matrix
COPY requirements.txt /app/

# Force pip to bypass its internal caching wheel storage to keep memory overhead lean
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the server engine files into the container space
COPY . /app/

# Expose the designated internal routing engine port
EXPOSE 10000

# Fire up Gunicorn as a single WSGI worker thread to fit safely inside the 2GB memory tier
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "app:app", "--workers", "1", "--timeout", "180"]