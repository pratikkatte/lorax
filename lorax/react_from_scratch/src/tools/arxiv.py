from typing import Optional
from langchain_community.utilities.arxiv import ArxivAPIWrapper
import json


def search(query: str) -> Optional[str]:
    """
    Fetch ArXiv information for a given search query using ArxivAPIWrapper and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query, title, and summary, or None if no result is found.
    """
    
    arxiv = ArxivAPIWrapper(
        top_k_results = 3,
        ARXIV_MAX_QUERY_LENGTH = 300,
        load_max_docs = 3,
        load_all_available_meta = False,
        doc_content_chars_max = 40000,
    )
    

    try:
        print(f"Searching Arxiv for: {query}")
        page = arxiv.run(query)

        if page.exists():
            # Create a dictionary with query, title, and summary
            result = {
                "query": query,
                "summary": page
            }
            print(f"Successfully retrieved summary for: {query}")
            return json.dumps(result, ensure_ascii=False, indent=2)
        else:
            print(f"No results found for query: {query}")
            return None

    except Exception as e:
        print(f"An error occurred while processing the Arxiv query: {e}")
        return None


if __name__ == '__main__':
    queries = ["Geoffrey Hinton", "Demis Hassabis"]

    for query in queries:
        result = search(query)
        if result:
            print(f"JSON result for '{query}':\n{result}\n")
        else:
            print(f"No result found for '{query}'\n")