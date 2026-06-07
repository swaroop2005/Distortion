#!/bin/bash
# Deploy ThalNet FastAPI backend as AWS Lambda + API Gateway.
# Run from repo root. Requires AWS CLI configured.
#
# Usage:
#   bash scripts/deploy_lambda.sh
#
# Env vars (all optional, have defaults):
#   FUNCTION_NAME   thalnet-api
#   ROLE_ARN        arn:aws:iam::ACCOUNT:role/ROLE  (must have LambdaBasicExecution + DynamoDB + Bedrock)
#   REGION          us-east-1
#   RUNTIME         python3.9
#   TIMEOUT         30
#   MEMORY          512

set -euo pipefail

FUNCTION_NAME="${FUNCTION_NAME:-thalnet-api}"
REGION="${REGION:-us-east-1}"
RUNTIME="${RUNTIME:-python3.9}"
TIMEOUT="${TIMEOUT:-30}"
MEMORY="${MEMORY:-512}"
ZIP_FILE="lambda_package.zip"

# Resolve ROLE_ARN from existing Lambda or fail fast with helpful message
if [ -z "${ROLE_ARN:-}" ]; then
  EXISTING=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query Role --output text 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    ROLE_ARN="$EXISTING"
    echo "Using existing role: $ROLE_ARN"
  else
    echo "ERROR: set ROLE_ARN env var (IAM role with LambdaBasicExecution + DynamoDB + Bedrock)"
    exit 1
  fi
fi

echo "=== ThalNet Lambda Deploy ==="
echo "Function : $FUNCTION_NAME"
echo "Region   : $REGION"
echo "Runtime  : $RUNTIME"
echo ""

# 1. Install deps into a temp dir
echo "[1/4] Installing Python deps …"
rm -rf /tmp/thalnet_lambda_pkg
pip install \
  --quiet \
  --target /tmp/thalnet_lambda_pkg \
  --platform manylinux2014_x86_64 \
  --only-binary=:all: \
  fastapi==0.111.0 \
  mangum==0.17.0 \
  pydantic==2.7.4 \
  uvicorn==0.30.1 \
  boto3==1.34.131 \
  pandas==2.2.2 \
  numpy==1.26.4 \
  scikit-learn==1.5.0 \
  joblib==1.4.2

# 2. Copy backend source + data artefacts
echo "[2/4] Packaging source …"
cp -r backend /tmp/thalnet_lambda_pkg/
cp -r data    /tmp/thalnet_lambda_pkg/
cp -r models  /tmp/thalnet_lambda_pkg/

# 3. Zip
echo "[3/4] Creating zip ($(du -sh /tmp/thalnet_lambda_pkg | cut -f1)) …"
cd /tmp/thalnet_lambda_pkg
zip -r -q "/tmp/$ZIP_FILE" .
cd - >/dev/null
echo "Zip size: $(du -sh /tmp/$ZIP_FILE | cut -f1)"

# 4. Create or update Lambda
echo "[4/4] Deploying to Lambda …"
EXISTING_FUNC=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.FunctionName' \
  --output text 2>/dev/null || true)

if [ -z "$EXISTING_FUNC" ]; then
  echo "Creating new function …"
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --role "$ROLE_ARN" \
    --handler "backend.app.main.handler" \
    --zip-file "fileb:///tmp/$ZIP_FILE" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --region "$REGION" \
    --environment "Variables={THALNET_LLM_BACKEND=bedrock,THALNET_DB=dynamodb,AWS_REGION_OVERRIDE=$REGION}"
else
  echo "Updating existing function …"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb:///tmp/$ZIP_FILE" \
    --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --environment "Variables={THALNET_LLM_BACKEND=bedrock,THALNET_DB=dynamodb,AWS_REGION_OVERRIDE=$REGION}" \
    --region "$REGION"
fi

echo ""
echo "=== Deploy complete ==="
echo "Test with:"
echo "  aws lambda invoke --function-name $FUNCTION_NAME --payload '{}' /tmp/out.json && cat /tmp/out.json"
echo ""
echo "Next: wire API Gateway HTTP API → Lambda (use console or aws apigatewayv2 commands)."
