import argparse
import os
import uvicorn

def args_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-api-key", help="OpenAI API Key")
    args = parser.parse_args()
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key is None and args.openai_api_key is None:
        print("Exception: Provide openai-api-key")
        return None
    return {"api": api_key}

def main():
    input_vals = args_parser()
    if not input_vals:
        return

    print("\nStarting local server...")
    print("Access the interface at http://localhost:8000/")
    print("Press CTRL+C to quit")

    uvicorn.run("lorax.lorax_app:app", host="0.0.0.0", port=8000, log_level="info", reload=True)

if __name__ == "__main__":
    main()
