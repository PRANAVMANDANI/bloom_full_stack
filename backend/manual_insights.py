import asyncio
import os
import sys

# Ensure the parent directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import connect_to_mongo, close_mongo_connection
from app.services.insights_engine import run_nightly_insights


async def main():
    print("Triggering insights generation...")
    await connect_to_mongo()
    await run_nightly_insights()
    await close_mongo_connection()
    print("Insights update complete!")


if __name__ == "__main__":
    asyncio.run(main())
