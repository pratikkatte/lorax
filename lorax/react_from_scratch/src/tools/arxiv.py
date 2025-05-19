from typing import Optional
from langchain_community.retrievers import ArxivRetriever
import json

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def search(query: str) -> Optional[str]:
    """
    Fetch ArXiv information for a given search query using ArxivRetriever and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query, title, and summary, or None if no result is found.
    """
    
    import time
    start = time.time()

    try:
        print(f"Searching Arxiv for: {query}")
        
        retriever = ArxivRetriever(
            load_max_docs=3,
            get_full_documents=True,
        )

        docs = retriever.invoke(query)
        docs = format_docs(docs)

        if docs is not None:
            # Create a dictionary with query, title, and summary
            result = {
                "query": query,
                "articles": docs
            }
            print(f"Successfully retrieved articles for: {query}")
            end = time.time()
            print(f"Time taken for arxiv search: {end - start} seconds")
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