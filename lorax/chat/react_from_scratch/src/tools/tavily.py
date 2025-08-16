import getpass
import os
import json
from dotenv import load_dotenv
from langchain_tavily import TavilySearch

load_dotenv()

def search(search_query: str, location: str = "") -> str:
    """
    Main function to execute the Tavily search using Tavily API and return the top results as a JSON string.

    Parameters:
    -----------
    search_query : str
        The search query to be executed using the Tavily API.

    Returns:
    --------
    str
        A JSON string containing the top search results or an error message, with updated key names.
    """

    try:
        print(f"Tavily search for: {search_query}")

        tavily_tool = TavilySearch(
            max_results=5,
            topic="general"
        )

        result = tavily_tool.invoke(search_query)

        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        print(f"An error occurred while processing the Tavily query: {e}")
        return None
    


if __name__ == "__main__":
    search_query = "Best gyros in Barcelona, Spain"
    result_json = search(search_query, '')
    print(result_json)