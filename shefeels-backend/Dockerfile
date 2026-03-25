# Backend Dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1

WORKDIR /code
COPY ./app /code/app
COPY requirements.txt /code/requirements.txt

# Install runtime dependencies. In production avoid installing dev/test packages.
RUN apt-get update && \
	apt-get install -y --no-install-recommends ffmpeg curl libpq-dev gcc python3-dev && \
	rm -rf /var/lib/apt/lists/* && \
	pip install --upgrade pip && pip install -r /code/requirements.txt && pip install gunicorn

EXPOSE 8000

# Health check to ensure the service is running and ready to accept connections.
# This checks the /health endpoint.
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
	CMD curl -f http://localhost:8000/health || exit 1

# Use gunicorn with uvicorn workers for better concurrency and faster warm workers.
# Adjust worker count based on available CPU (2-4 is a reasonable default for small EC2 instances).
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "3", "-b", "0.0.0.0:8000", "app.main:app"]
