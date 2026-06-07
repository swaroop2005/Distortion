#!/bin/bash
# ThalNet full AWS deploy — run from repo root.
# Runs all steps in order. Idempotent.
#
# Prerequisites:
#   - AWS CLI configured (or run from EC2 with IAM role)
#   - Python + .venv installed
#   - node/npm installed (for Amplify build)
#
# Usage:
#   ACCOUNT_ID=209556026518 bash scripts/deploy_aws.sh

set -euo pipefail

REGION="${REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-209556026518}"
PREFIX="${THALNET_TABLE_PREFIX:-ThalNet-}"
API_GW_URL="${API_GW_URL:-}"  # set after API Gateway is created

echo "=============================="
echo " ThalNet AWS Deploy"
echo " Region:  $REGION"
echo " Account: $ACCOUNT_ID"
echo "=============================="
echo ""

# ── Step 1: DynamoDB tables ────────────────────────────────────────────────────
echo "[1/5] Creating DynamoDB tables …"
.venv/bin/python scripts/create_dynamo_tables.py
echo ""

# ── Step 2: Seed Users table ──────────────────────────────────────────────────
echo "[2/5] Seeding Users from clean.csv …"
AWS_REGION=$REGION .venv/bin/python scripts/seed_dynamo.py
echo ""

# ── Step 3: SNS escalation topic ──────────────────────────────────────────────
echo "[3/5] Creating SNS escalation topic …"
TOPIC_ARN=$(aws sns create-topic \
  --name ThalNet-Escalation \
  --region "$REGION" \
  --query TopicArn --output text)
echo "  SNS topic: $TOPIC_ARN"
echo ""

# ── Step 4: Lambda deploy ─────────────────────────────────────────────────────
echo "[4/5] Deploying Lambda …"
# Find or create IAM role
ROLE_NAME="ThalNet-Lambda-Role"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text 2>/dev/null || true)

if [ -z "$ROLE_ARN" ]; then
  echo "  Creating IAM role $ROLE_NAME …"
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' --output text --query Role.Arn > /dev/null

  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess

  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
  echo "  Waiting for role propagation …"
  sleep 10
fi

echo "  Role: $ROLE_ARN"
ROLE_ARN=$ROLE_ARN bash scripts/deploy_lambda.sh
echo ""

# ── Step 5: API Gateway HTTP API ──────────────────────────────────────────────
echo "[5/5] Wiring API Gateway …"
FUNC_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:thalnet-api"

API_ID=$(aws apigatewayv2 get-apis \
  --region "$REGION" \
  --query "Items[?Name=='thalnet-http-api'].ApiId" \
  --output text 2>/dev/null || true)

if [ -z "$API_ID" ]; then
  echo "  Creating HTTP API …"
  API_ID=$(aws apigatewayv2 create-api \
    --name thalnet-http-api \
    --protocol-type HTTP \
    --region "$REGION" \
    --query ApiId --output text)

  # Lambda integration
  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$FUNC_ARN" \
    --payload-format-version "2.0" \
    --region "$REGION" \
    --query IntegrationId --output text)

  # Catch-all route
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "ANY /{proxy+}" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null

  # Auto deploy stage
  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" > /dev/null

  # Allow API Gateway to invoke Lambda
  aws lambda add-permission \
    --function-name thalnet-api \
    --statement-id apigw-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    --region "$REGION" > /dev/null
fi

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
echo "  API Gateway URL: $API_URL"
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo "=============================="
echo " Deploy complete!"
echo "=============================="
echo ""
echo " Backend  : $API_URL"
echo " Test     : curl $API_URL/"
echo ""
echo " Next: set VITE_API_URL=$API_URL in amplify.yml"
echo "        then push to trigger Amplify build."
echo ""
echo " Step Functions: upload infra/step_functions.json via AWS Console"
echo "  → Step Functions → Create state machine → paste JSON"
