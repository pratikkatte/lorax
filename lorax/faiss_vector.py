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
from lorax.config import LLM_TYPE, MODEL_NAME
from langchain.prompts import ChatPromptTemplate, PromptTemplate


load_dotenv()

print("Environment variables loaded.")

DOC_PATH = "lorax/data-new.txt"
MODEL_NAME = "llama3.2"
EMBEDDING_MODEL = "nomic-embed-text"
VECTOR_STORE_NAME = "simple-rag"
PERSIST_DIRECTORY = './tskit-vector'

# if LLM_TYPE == "OPENAI":
#     print("Using OpenAI embeddings.")
#     embeddings = OpenAIEmbeddings()
# else:
#     print("Using Ollama LLM embeddings.")
#     ollama.pull("nomic-embed-text")
#     embeddings = OllamaEmbeddings(model="nomic-embed-text", temperature=0)

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

    python_docs = python_splitter.create_documents([data])
    print(f"Document split into {len(python_docs)} chunks.")
    return data, python_docs

def getRetriever():
    print("Initializing retriever.")
    
    data_file_path = resource_filename(__name__, 'data-new.txt')
    tskit_file_path = resource_filename(__name__, 'tskit-vector')

    print(f"Data file path: {data_file_path}")
    print(f"Vector store path: {tskit_file_path}")
    ollama.pull("nomic-embed-text")
    embeddings = OllamaEmbeddings(model="nomic-embed-text", temperature=0)

    if os.path.exists(PERSIST_DIRECTORY):
        print("Vector store exists. Loading from disk.")
        vector_store = FAISS.load_local(PERSIST_DIRECTORY, embeddings, allow_dangerous_deserialization=True)
    else:
        print("Vector store does not exist. Creating a new one.")
        data, _ = read_document(DOC_PATH)
        python_splitter = character.RecursiveCharacterTextSplitter.from_language(
            language=base.Language.PYTHON
        )
        python_splits = python_splitter.split_text(data)
        print(f"Data split into {len(python_splits)} chunks.")
        vector_store = FAISS.from_texts(python_splits, embeddings)
        print("Saving vector store to disk.")
        vector_store.save_local(PERSIST_DIRECTORY)
    
    print("Creating retriever from vector store.")

    # if LLM_TYPE == "OPENAI":
    #     retriever = vector_store.as_retriever(
    #         search_type="similarity",  # Also test "similarity", "mmr"
    #         search_kwargs={"k": 5}
    #     )
    # else:

    QUERY_PROMPT = PromptTemplate(
            input_variables=["question"],
            template="""You are an AI language model assistant. Your task is to generate five
    different versions of the given user question to retrieve relevant documents from
    a vector database. By generating multiple perspectives on the user question, your
    goal is to help the user overcome some of the limitations of the distance-based
    similarity search. Provide these alternative questions separated by newlines.
    Original question: {question}""",
    )
    llm = ChatOllama(model="llama3.2")
    retriever = MultiQueryRetriever.from_llm(
        vector_store.as_retriever(), llm, prompt=QUERY_PROMPT
    )

    print("Retriever initialized.")
    return retriever

# vector_store = get_vector_store()
