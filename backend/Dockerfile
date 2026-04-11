FROM python:3.10-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu torchvision==0.17.2+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Hard-pin numpy BEFORE installing other packages.
# This prevents transitive dependencies (e.g. scikit-image's resolver)
# from silently upgrading numpy to 2.x, which causes:
#   RuntimeError: Unable to configure default ndarray.__repr__
RUN pip install --no-cache-dir "numpy==1.26.4"

COPY requirements.txt .
# Use --constraint to enforce numpy pin during full install
RUN echo "numpy==1.26.4" > /constraints.txt && \
    pip install --no-cache-dir \
    -r requirements.txt \
    -c /constraints.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

COPY . .
RUN mkdir -p uploads

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
