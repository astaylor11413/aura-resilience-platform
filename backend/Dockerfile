# Switch to a lightweight Conda-based image to get pre-compiled GIS binaries
FROM condaforge/mambaforge:latest

# Prevent Python from writing pyc files to disk and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install necessary system dependencies via apt-get if your other packages need them
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt /app/

# 1. Install richdem cleanly using pre-compiled binaries from conda-forge
# 2. Install the rest of your requirements using pip
RUN mamba install -y -c conda-forge richdem && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the server engine files into the container space
COPY . /app/

# Expose the designated internal routing engine port
EXPOSE 10000

# Fire up Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "app:app", "--workers", "1", "--timeout", "180"]