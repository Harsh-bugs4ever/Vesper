# The whole backend, in one image.
#
# There were thirteen of these, each copying one service directory and differing only
# in the port it exposed. One process needs one image: the build context is the repo
# root, and what lands in it is the application package, the shared library and the
# migrations.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Dependencies first: this layer is cached until a requirements file actually changes.
# The engine extras (prophet, xgboost, ortools) dominate the build — keeping them above
# the source copy means editing a handler does not reinstall them.
COPY requirements-base.txt requirements.txt ./
COPY packages/py-common ./packages/py-common
RUN pip install --no-cache-dir -r requirements.txt

# Migrations and the bootstrap script, so the image can bring a database up to head.
COPY alembic.ini ./alembic.ini
COPY infra ./infra

COPY app ./app

EXPOSE 8000

# `uvicorn --workers N` would fork the background threads with it: N schedulers and N
# bus consumers per container. The scheduler's Redis lease makes that survivable and
# the consumer groups make it correct, but it is still N times the work for no gain
# here. One worker per container; scale by adding containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
