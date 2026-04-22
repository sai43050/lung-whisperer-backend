FROM python:3.10-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu torchvision==0.17.2+cpu torchaudio==2.2.2+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Hard-pin numpy BEFORE installing other packages.
RUN pip install --no-cache-dir "numpy==1.26.4" && \
    python -c "import numpy; assert numpy.__version__ == '1.26.4', f'Wrong numpy version: {numpy.__version__}'"

COPY requirements.txt .
# Use --constraint to enforce numpy pin during full install and verify after
RUN echo "numpy==1.26.4" > /constraints.txt && \
    pip install --no-cache-dir \
    -r requirements.txt \
    -c /constraints.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu && \
    python -c "import numpy; assert numpy.__version__ == '1.26.4', f'NumPy corrupted during install: {numpy.__version__}'"

COPY . .
RUN mkdir -p uploads

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
