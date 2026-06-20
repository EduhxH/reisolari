# Backend FastAPI — imagem de produção
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# `curl` é usado pelo HEALTHCHECK. As wheels manylinux do Pillow/reportlab já
# trazem as libs nativas, por isso não são precisos pacotes de imagem extra.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
# Pasta de uploads (faturas + imagens dos anúncios). Em produção, montar um
# volume persistente em /app/uploads para os ficheiros sobreviverem a redeploys.
RUN mkdir -p uploads/bills

# Plataformas como o Render injetam $PORT; em local/compose usa 8000 por omissão.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD sh -c 'curl -fsS http://localhost:${PORT:-8000}/health || exit 1'

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
