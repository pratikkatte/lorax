import argparse
import uvicorn

def args_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-api-key", help="OpenAI API Key")
    args = parser.parse_args()

def main():

    print("\nStarting Lorax server on http://localhost:8000/")
    uvicorn.run("lorax.lorax_app:app", host="0.0.0.0", port=8000, reload=True)

# if __name__ == "__main__":
#     main()
