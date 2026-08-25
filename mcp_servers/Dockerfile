FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends coinor-cbc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose Uvicorn's default port
EXPOSE 8001

# Bind to 0.0.0.0 so it is accessible outside the container
CMD ["uvicorn", "image_scraper:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
