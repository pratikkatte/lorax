from typing import Optional
import json

import os
from pkg_resources import resource_filename
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters.character import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import Language
from langchain_text_splitters import character, base
from langchain.retrievers.multi_query import MultiQueryRetriever
from dotenv import load_dotenv
from langchain_ollama.llms import OllamaLLM
from langchain_ollama import ChatOllama
import ollama
from langchain.prompts import ChatPromptTemplate, PromptTemplate
import numpy as np
import pickle
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from sentence_transformers.cross_encoder import CrossEncoder
from lorax.chat.faiss_vector import getRetriever, rerank_documents


load_dotenv()

retriever, reranker = getRetriever(0.8, 0.2)

FAISS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../code-chunker/faiss-vector")
)

PKL_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../code-chunker/documents.pkl")
)

def rerank_documents(query: str,reranker, documents: list, top_k: int = 3) -> list:
    """Re-rank documents using cross-encoder"""
    pairs = [(query, doc.page_content) for doc in documents]
    
    scores = reranker.predict(pairs)
    
    ranked_indices = np.argsort(scores)[::-1]  
    ranked_docs = [documents[i] for i in ranked_indices]
    
    return ranked_docs[:top_k]

def repo_to_text(path, output_file):
    print(f"Starting to process repository at {path}.")
    with open(output_file, 'w', encoding='utf-8') as file:
        for root, dirs, files in os.walk(path):
            for filename in files:
                if filename.endswith((".py", ".md")):
                    filepath = os.path.join(root, filename)
                    print(f"Processing file: {filepath}")
                    file.write(f"\n\n--- {filepath} ---\n\n")
                    with open(filepath, 'r') as f:
                        content = f.read()
                        file.write(content)
    print(f"Content written to {output_file}")

def read_document(file_path):
    print(f"Reading document from {file_path}.")
    with open(file_path, 'r') as file:
        data = file.read()
    
    print("Splitting document into chunks.")
    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, chunk_size=50, chunk_overlap=0
    )

    python_docs = python_splitter.split_text(data)
    print(f"Document split into {len(python_docs)} chunks.")
    return python_docs



def search(query: str) -> Optional[str]:
    """
    Fetch tskit information for a given search query using FAISS vector and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query, title, and summary, or None if no result is found.
    """
    import time
    start = time.time()

    try:
        print(f"Searching Tskit Documentation for: {query}")

        try:
            # Retriever model
            docs = retriever.invoke(query)
            final_context = rerank_documents(query, reranker, docs, 5)
        except Exception as e:
            print("context Error:", e)

        final_context_parsed = "\n".join([doc.page_content.strip() for doc in final_context])

        if final_context_parsed:
            # Create a dictionary with query, title, and summary
            result = {
                "query": query,
                "title": "Tskit Retrieved Information",
                "summary": final_context_parsed
            }
            print(f"Successfully retrieved summary for: {query}")
            end = time.time()
            print(f"Time taken for tskit search: {end - start} seconds")
            return json.dumps(result, ensure_ascii=False, indent=2)
        else:
            print(f"No results found for query: {query}")
            return None

    except Exception as e:
        print(f"An error occurred while processing the Tskit query: {e}")
        return None


if __name__ == '__main__':
    queries = ["Geoffrey Hinton", "Demis Hassabis"]

    for query in queries:
        result = search(query)
        if result:
            print(f"JSON result for '{query}':\n{result}\n")
        else:
            print(f"No result found for '{query}'\n")