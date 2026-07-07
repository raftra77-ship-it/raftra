

def router_decision_engine(campaign_goal: str, request_text: str) -> dict:
    """
    Simulates an LLM decision to route to the correct models.
    In production, this uses PydanticAI to return structured JSON.
    """
    request_text = request_text.lower()
    
    # Defaults
    image_provider = "flux_schnell"
    video_provider = None
    
    if "typography" in request_text or "text heavy" in request_text:
        image_provider = "ideogram"
    elif "realism" in request_text or "product" in request_text:
        image_provider = "flux_pro"
    elif "illustration" in request_text or "drawing" in request_text:
        image_provider = "recraft"
    elif "edit" in request_text:
        image_provider = "gpt_image"
        
    if "video" in request_text or "cinematic" in request_text:
        video_provider = "seedance"
        
    return {
        "image_provider": image_provider,
        "video_provider": video_provider,
        "reasoning": "Routed based on keyword analysis."
    }
