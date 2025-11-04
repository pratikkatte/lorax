import argparse
import uvicorn
import os

def args_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-api-key", help="OpenAI API Key")
    args = parser.parse_args()

def main():
    # Get environment variables for Cloud Run
    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "0.0.0.0")
    
    # Disable reload in production
    reload_enabled = os.getenv("RELOAD", "true").lower() == "true"
    
    print(f"\nStarting Lorax server on {host}:{port}")
    print(f"Reload: {reload_enabled}")
    
    uvicorn.run(
        "lorax.lorax_app:sio_app",
        host=host,
        port=port,
        reload=reload_enabled,
        # Production optimizations
        access_log=True,
        use_colors=False,  # Better for structured logging in Cloud Run
    )

# if __name__ == "__main__":
#     main()
