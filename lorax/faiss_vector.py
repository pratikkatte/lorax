import os 

from pkg_resources import resource_filename


from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

from langchain_text_splitters.character import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import Language
from langchain_text_splitters import character, base
from dotenv import load_dotenv

from langchain_ollama import OllamaEmbeddings
import pickle
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from lorax.retriever.create_documents import createFaissVector, createDocs
from sentence_transformers.cross_encoder import CrossEncoder
import numpy as np

load_dotenv()

def repo_to_text(path, output_file):
    with open(output_file, 'w', encoding='utf-8') as file:
        for root, dirs, files in os.walk(path):
            for filename in files:
                if filename.endswith((".py", ".md")):
                    filepath = os.path.join(root, filename)
                    file.write(f"\n\n--- {filepath} ---\n\n")
                    with open(filepath, 'r') as f:
                        content = f.read()
                        file.write(content)
        print(f"Content written to {output_file}")

def read_document(file_path):
    with open(file_path, 'r') as file:
        data = file.read()
    
    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, chunk_size=50, chunk_overlap=0
    )

    python_docs = python_splitter.create_documents([data])
    return data, python_docs


def rerank_documents(query: str,reranker, documents: list, top_k: int = 3) -> list:
    """Re-rank documents using cross-encoder"""
    pairs = [(query, doc.page_content) for doc in documents]
    
    scores = reranker.predict(pairs)
    
    ranked_indices = np.argsort(scores)[::-1]  
    ranked_docs = [documents[i] for i in ranked_indices]
    
    return ranked_docs[:top_k]

def getRetriever():
    """
    """
    # embeddings = OpenAIEmbeddings()

    # data_file_path = resource_filename(__name__, 'data-new.txt')
    # tskit_file_path =  resource_filename(__name__, 'tskit-vector')


    # if os.path.exists(tskit_file_path):
    #     vector_store = FAISS.load_local(tskit_file_path, embeddings, allow_dangerous_deserialization=True)
    # else:
    #     data, _ = read_document(data_file_path)
    #     python_splitter = character.RecursiveCharacterTextSplitter.from_language(
    #         language=base.Language.PYTHON
    #         )
    #     python_splits = python_splitter.split_text(data)
    #     vector_store = FAISS.from_texts(python_splits, embeddings)
    #     vector_store.save_local(tskit_file_path)
    
    # retriever = vector_store.as_retriever(
    #     search_type="similarity",  # Also test "similarity", "mmr"
    #     search_kwargs={"k": 5}
    #     )


    ## New retriever

    embeddings = OllamaEmbeddings(model="nomic-embed-text")

    faiss_vector_file_path = './lorax/retriever/data/faiss-vector'
    documents_path = './lorax/retriever/data/documents.pkl'

    if os.path.exists(documents_path):
        ## Load documents for BM25Retriever
        with open(documents_path, 'rb') as file:
            all_documents = pickle.load(file)
    else:
        all_documents = createDocs(create_faiss=False, to_return=True)

    bm25_retriever = BM25Retriever.from_documents(documents=all_documents, k=10, search_kwargs={"k": 10})

    if os.path.exists(faiss_vector_file_path):
        vector_store = FAISS.load_local(folder_path=faiss_vector_file_path, embeddings=embeddings, index_name="faiss_index", allow_dangerous_deserialization=True)
    else:
        vector_store = createFaissVector(to_save=faiss_vector_file_path)
    

    faiss_retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"score_threshold": 0.5, "k": 10}
    )

    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, faiss_retriever],
        weights=[0.5, 0.5]  # Adjust based on your use case
    )

    reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2") 

    return ensemble_retriever, reranker

