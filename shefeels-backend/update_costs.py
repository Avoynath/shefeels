import asyncio
from sqlalchemy.future import select
from app.core.database import AsyncSessionLocal
from app.models.app_config import AppConfig

async def main():
    async with AsyncSessionLocal() as db:
        # 1. Print current costs
        print("--- Current Costs ---")
        result = await db.execute(select(AppConfig).where(AppConfig.parameter_name.like('%COST%')))
        configs = result.scalars().all()
        config_map = {c.parameter_name: c for c in configs}
        for k, c in config_map.items():
            print(f"{k}: {c.parameter_value}")

        # 2. Define new costs based on user request
        new_costs = {
            "CHAT_COST": "0",
            "IMAGE_COST": "6",
            "VOICE_COST": "4",
            "CHARACTER_COST": "6",
        }

        print("\n--- Updating Costs ---")
        for param, value in new_costs.items():
            if param in config_map:
                config_map[param].parameter_value = value
                print(f"Updated {param} to {value}")
            else:
                # Create new if it doesn't exist
                new_conf = AppConfig(
                    category="pricing",
                    parameter_name=param,
                    parameter_value=value,
                    parameter_description=f"Cost for {param.replace('_', ' ').lower()}"
                )
                db.add(new_conf)
                print(f"Created {param} with value {value}")
        
        await db.commit()
        print("\n✅ All costs updated successfully.")

if __name__ == "__main__":
    asyncio.run(main())
