#!/bin/sh
set -eu
case "$AUSCULTA_VLLM_IMAGE" in
  *@sha256:*) digest=${AUSCULTA_VLLM_IMAGE##*@sha256:} ;;
  *) echo 'Falta una imagen fijada por digest SHA-256.' >&2; exit 1 ;;
esac
case "$digest" in *[!0-9a-f]*) echo 'Digest de imagen inválido.' >&2; exit 1 ;; esac
test "${#digest}" -eq 64
# Nunca activar set -x: expondría la credencial. El secreto no es un argumento.
VLLM_API_KEY=$(cat /run/secrets/inferencia_key)
test -n "$VLLM_API_KEY"
export VLLM_API_KEY
exec vllm serve /model \
  --host 0.0.0.0 --port 8000 \
  --served-model-name "$AUSCULTA_SERVED_MODEL" \
  --max-model-len "$AUSCULTA_MODEL_CONTEXT" \
  --max-num-seqs 2 \
  --gpu-memory-utilization 0.90 \
  --no-enable-log-requests \
  --no-trust-request-chat-template
