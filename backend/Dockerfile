FROM python:3.10-slim

WORKDIR /app

# System dependencies for Medical Vision and Audio
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Optimize for Railway: Install core dependencies in a single layer
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads

EXPOSE 8000

# Start with optimized worker count for stability
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
