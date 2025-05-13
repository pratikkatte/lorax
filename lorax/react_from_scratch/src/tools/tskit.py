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
import np
import pickle
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from sentence_transformers.cross_encoder import CrossEncoder


load_dotenv()

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


def getRetriever():
    print("Initializing retriever.")
    
    # # ollama.pull("nomic-embed-text")
    # embeddings = OllamaEmbeddings(base_url="https://nn6yywhy2oizpq-11434.proxy.runpod.net/", model="nomic-embed-text", temperature=0)
    # # embeddings = OllamaEmbeddings(model="nomic-embed-text", temperature=0)


    # if os.path.exists(PERSIST_DIRECTORY):
    #     print("Vector store exists. Loading from disk.")
    #     vector_store = FAISS.load_local(PERSIST_DIRECTORY, embeddings, allow_dangerous_deserialization=True)
    # else:
    #     print("Vector store does not exist. Creating a new one.")
    #     python_splits = read_document(DOC_PATH)
    #     print(f"Data split into {len(python_splits)} chunks.")
    #     vector_store = FAISS.from_texts(python_splits, embeddings)
    #     print("Saving vector store to disk.")
    #     vector_store.save_local(PERSIST_DIRECTORY)
    
    # print("Creating retriever from vector store.")

    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    vector_store = FAISS.load_local(folder_path=FAISS_DIR, embeddings=embeddings, index_name="faiss_index", allow_dangerous_deserialization=True)
    ## Load documents for BM25Retriever
    
    try:
        with open(PKL_FILE, "rb") as f:
            all_documents = pickle.load(f)
        print("Loaded successfully.")
    except Exception as e:
        print("Failed to load:", e)
        

    bm25_retriever = BM25Retriever.from_documents(documents=all_documents, k=10, search_kwargs={"k": 10})

    faiss_retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"score_threshold": 0.5, "k": 10}
    )

    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, faiss_retriever],
        weights=[0.5, 0.5]  # Adjust based on your use case
    )

    # if LLM_TYPE == "OPENAI":
    #     retriever = vector_store.as_retriever(
    #         search_type="similarity",  # Also test "similarity", "mmr"
    #         search_kwargs={"k": 5}
    #     )
    # else:

    # QUERY_PROMPT = PromptTemplate(
    #         input_variables=["question"],
    #         template="""You are an AI language model assistant. Your task is to generate five
    # different versions of the given user question to retrieve relevant documents from
    # a vector database. By generating multiple perspectives on the user question, your
    # goal is to help the user overcome some of the limitations of the distance-based
    # similarity search. Provide these alternative questions separated by newlines.
    # Original question: {question}""",
    # )
    # llm = ChatOllama(base_url="https://nn6yywhy2oizpq-11434.proxy.runpod.net/", model="llama3.2")
    # # llm = ChatOllama(model="llama3.2")
    # retriever = MultiQueryRetriever.from_llm(
    #     vector_store.as_retriever(), llm, prompt=QUERY_PROMPT
    # )

    print("Retriever initialized.")
    return ensemble_retriever


def search(query: str) -> Optional[str]:
    """
    Fetch tskit information for a given search query using FAISS vector and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query, title, and summary, or None if no result is found.
    """

    try:
        print(f"Searching Tskit Documentation for: {query}")

        retriever = getRetriever()
        
        # Retriever model
        context = retriever.invoke(query)


        # docs = retriever.get_relevant_documents(question)
        # context = "\n".join([doc.page_content for doc in docs])

        reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2") 
        final_context = rerank_documents(query, reranker, context, 3)
        final_context_parsed = "\n".join([doc.page_content.strip() for doc in final_context])

        if context:
            # Create a dictionary with query, title, and summary
            result = {
                "query": query,
                "title": "Tskit Retrieved Information",
                "summary": final_context_parsed
            }
            print("result:", result)
            print(f"Successfully retrieved summary for: {query}")
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