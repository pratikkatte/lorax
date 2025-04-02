# Import Packages
import streamlit as st
import os
import logging
from langchain_community.document_loaders import UnstructuredPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import Language
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain.prompts import ChatPromptTemplate, PromptTemplate
from langchain_ollama import ChatOllama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.retrievers.multi_query import MultiQueryRetriever
import ollama
from pkg_resources import resource_filename
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import character, base

# Define Variables
DOC_PATH = "./data-new.txt"
MODEL_NAME = "llama3.2"
EMBEDDING_MODEL = "nomic-embed-text"
VECTOR_STORE_NAME = "simple-rag"
PERSIST_DIRECTORY = './tskit-vector'


# ## Load text file using Langchain Text Loader
# def ingest_text(doc_path):
#     """Load text documents."""
#     print("Loading text from:", doc_path)
#     if os.path.exists(doc_path):
#         print("Text file found.")
#         loader = TextLoader(file_path=doc_path)
#         data = loader.load()
#         logging.info("Text loaded successfully.")
#         return data
#     else:
#         logging.error(f"Text file not found at path: {doc_path}")
#         st.error("Text file not found.")
#         return None 

# ## Split the PDF file using Langchain RecursiveCharacterTextSplitter
# def split_documents(documents):
#     """Split documents into smaller chunks."""
#     text_splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=300)
#     chunks = text_splitter.split_documents(documents)
#     logging.info("Documents split into chunks.")
#     return chunks 



def read_document(file_path):
    with open(file_path, 'r') as file:
        data = file.read()
    
    # python_splitter = RecursiveCharacterTextSplitter.from_language(
    #     language=Language.PYTHON, chunk_size=50, chunk_overlap=0
    # )

    # python_docs = python_splitter.create_documents([data])
    return data


def create_retriever():
    """Create a retriever."""

    embedding = OllamaEmbeddings(model=EMBEDDING_MODEL, temperature=0)

    data_file_path = resource_filename(__name__, 'data-new.txt')
    tskit_file_path =  resource_filename(__name__, 'tskit-vector')

    if os.path.exists(tskit_file_path):
        print("Loading existing vector database...")
        vector_db = FAISS.load_local(tskit_file_path, embedding, allow_dangerous_deserialization=True)
        print("Vector database loaded.")
    else:
        print("Creating new vector database...")
        # Load and process the text document
        data = read_document(data_file_path)
        python_splitter = character.RecursiveCharacterTextSplitter.from_language(
            language=base.Language.PYTHON
            )
        python_splits = python_splitter.split_text(data)
        vector_db = FAISS.from_texts(python_splits, embedding)
        vector_db.save_local(tskit_file_path)


    retriever = vector_db.as_retriever(
        search_type="similarity",  # Also test "similarity", "mmr"
        search_kwargs={"k": 5}
    )

    return retriever


def create_chain(retriever, llm, input_query):
    """Create the chain with preserved syntax."""

    # Retriever model
    docs = retriever.invoke(input_query)

    # docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])

    template = """You are a coding generator with expertise in using tskit toolkit for analysing tree-sequences. \n 
                    Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Use the tskit module to answer the user 
                    question based on the above provided documentation. Ensure any code you provide should be a callable function and can be executed \n 
                    with all required imports and variables defined. Structure your answer with a description of the code solution. \n
                    Then list the imports. And finally list the functioning code block. Maintain this order. The function should return a string providing the answer. Here is the user question: {question}"""

    prompt = ChatPromptTemplate.from_template(template)

    print("in create_chain")
    chain = (
        prompt
        | llm 
    )
    print("chain created")

    response = chain.invoke({"context": context, "question": input_query})
    
    return response


def setup_llm_and_retriever():
    # Initialize the language model
    print("Loading language model...")
    llm = ChatOllama(model=MODEL_NAME, temperature=0)

    # Load the vector database
    print("Loading vector database and making retriever...")
    retriever = create_retriever()

    return llm, retriever 

llm, retriever = setup_llm_and_retriever()


def main():
    
    st.title("Ollama Llama 3.2 - Code Generator RAG Test")

    # User input
    user_input = st.text_input("Enter your question:", "")


    if user_input:
        with st.spinner("Generating response..."):
            try:
                # Create the chain
                print("Creating chain...")
                response = create_chain(retriever, llm, user_input)

                st.markdown("**Assistant:**")
                st.write(response.content)
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
    else:
        st.info("Please enter a question to get started.")

if __name__ == "__main__":
    main()