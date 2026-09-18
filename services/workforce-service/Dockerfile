# Build context is the repo root, so the shared package and requirements are reachable.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first: this layer is cached until a requirements file actually changes.
COPY requirements-base.txt ./requirements-base.txt
COPY packages/py-common ./packages/py-common
COPY services/workforce-service/requirements.txt ./services/workforce-service/requirements.txt
RUN pip install --no-cache-dir -r services/workforce-service/requirements.txt

COPY services/workforce-service/app ./app

EXPOSE 8010

# One worker per container; scale by adding containers, not threads.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
