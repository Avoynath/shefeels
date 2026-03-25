
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

def check_identity():
    try:
        sts = boto3.client(
            'sts',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        identity = sts.get_caller_identity()
        print("Credentials identity:")
        print(f"UserId: {identity['UserId']}")
        print(f"Account: {identity['Account']}")
        print(f"Arn: {identity['Arn']}")
        
        s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Check if we can list the bucket
        bucket_name = "honeylove-backend-672911155558-us-east-1-assets"
        print(f"\nChecking access to bucket: {bucket_name}")
        try:
            s3.head_bucket(Bucket=bucket_name)
            print(f"✅ Has access to {bucket_name}")
        except Exception as e:
            print(f"❌ Failed to access {bucket_name}: {e}")

    except Exception as e:
        print(f"Error checking identity: {e}")

if __name__ == "__main__":
    check_identity()
