# Stage 1: build the React frontend
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend that also serves the built frontend
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist ./static

ENV STATIC_DIR=/app/static \
    PORT=8000
EXPOSE 8000
# Shell form so Heroku's $PORT is honoured.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
