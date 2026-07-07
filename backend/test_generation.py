import asyncio
from dotenv import load_dotenv

# Load env before importing providers
load_dotenv()

from agents.creative_nodes.generation_graph import generation_graph

async def main():
    print("Starting Ad Generation Workflow Test...")
    
    initial_state = {
        "workspace_id": 1,
        "campaign_goal": "Increase brand awareness for our new energy drink",
        "request_text": "Create a high-energy ad showing people jumping. I want a realistic product shot.",
        "cached_typography": {},
        "cached_colors": [],
        "cached_brand_voice": "Energetic and Bold",
        "selected_image_provider": "",
        "selected_video_provider": "",
        "strategy": "",
        "copy": "",
        "image_url": "",
        "video_url": "",
        "logs": [],
        "status": "queued"
    }

    print("\n--- Running Graph ---")
    result = await generation_graph.ainvoke(initial_state)
    
    print("\nExecution Finished. Results:")
    print("="*50)
    print("Strategy:\n", result.get("strategy"))
    print("-" * 50)
    print("Ad Copy:\n", result.get("copy"))
    print("-" * 50)
    print("Generated Image URL:\n", result.get("image_url"))
    print("-" * 50)
    print("Selected Image Provider:\n", result.get("selected_image_provider"))
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())
