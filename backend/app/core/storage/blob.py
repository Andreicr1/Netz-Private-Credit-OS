from __future__ import annotations

from datetime import datetime, timedelta

from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas


def get_blob_service(account_url: str, credential: str):
    return BlobServiceClient(account_url=account_url, credential=credential)


def generate_upload_sas(account_name, container, blob_name, account_key, ttl_minutes):
    expiry = datetime.utcnow() + timedelta(minutes=ttl_minutes)

    return generate_blob_sas(
        account_name=account_name,
        container_name=container,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=expiry,
    )

