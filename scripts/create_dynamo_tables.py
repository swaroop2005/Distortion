#!/usr/bin/env python3
"""Create all ThalNet DynamoDB tables (on-demand billing, idempotent).

Usage:
    AWS_PROFILE=default python scripts/create_dynamo_tables.py
    # or with explicit region:
    AWS_REGION=us-east-1 python scripts/create_dynamo_tables.py
"""
import os
import sys
import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "us-east-1")
PREFIX = os.getenv("THALNET_TABLE_PREFIX", "ThalNet-")

TABLES = [
    {
        "TableName": PREFIX + "Users",
        "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
        "AttributeDefinitions": [{"AttributeName": "userId", "AttributeType": "S"}],
    },
    {
        "TableName": PREFIX + "Bridges",
        "KeySchema": [{"AttributeName": "bridgeId", "KeyType": "HASH"}],
        "AttributeDefinitions": [{"AttributeName": "bridgeId", "AttributeType": "S"}],
    },
    {
        "TableName": PREFIX + "Requests",
        "KeySchema": [{"AttributeName": "requestId", "KeyType": "HASH"}],
        "AttributeDefinitions": [{"AttributeName": "requestId", "AttributeType": "S"}],
    },
    {
        "TableName": PREFIX + "Conversations",
        "KeySchema": [
            {"AttributeName": "userId", "KeyType": "HASH"},
            {"AttributeName": "ts",     "KeyType": "RANGE"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "userId", "AttributeType": "S"},
            {"AttributeName": "ts",     "AttributeType": "S"},
        ],
    },
    {
        "TableName": PREFIX + "Outcomes",
        "KeySchema": [
            {"AttributeName": "requestId", "KeyType": "HASH"},
            {"AttributeName": "donorId",   "KeyType": "RANGE"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "requestId", "AttributeType": "S"},
            {"AttributeName": "donorId",   "AttributeType": "S"},
        ],
    },
]


def create_all():
    client = boto3.client("dynamodb", region_name=REGION)
    for spec in TABLES:
        name = spec["TableName"]
        try:
            client.create_table(
                TableName=name,
                KeySchema=spec["KeySchema"],
                AttributeDefinitions=spec["AttributeDefinitions"],
                BillingMode="PAY_PER_REQUEST",
            )
            print(f"  created  {name}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceInUseException":
                print(f"  exists   {name} (skipped)")
            else:
                print(f"  ERROR    {name}: {e}", file=sys.stderr)
                raise

    # Wait for all tables to be ACTIVE
    waiter = client.get_waiter("table_exists")
    for spec in TABLES:
        name = spec["TableName"]
        print(f"  waiting  {name} …", end=" ", flush=True)
        waiter.wait(TableName=name, WaiterConfig={"Delay": 3, "MaxAttempts": 20})
        print("ACTIVE")

    print("\nAll tables ready.")


if __name__ == "__main__":
    print(f"Region: {REGION}  Prefix: {PREFIX}\n")
    create_all()
