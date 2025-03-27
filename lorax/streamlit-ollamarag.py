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
DOC_PATH = "lorax/data-new.txt"
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
    
    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, chunk_size=50, chunk_overlap=0
    )

    python_docs = python_splitter.create_documents([data])
    return data, python_docs


def load_vector_db():
    """Load or create the vector database."""
    # Pull the embedding model if not already available
    ollama.pull(EMBEDDING_MODEL)

    embedding = OllamaEmbeddings(model=EMBEDDING_MODEL, temperature=0)

    if os.path.exists(PERSIST_DIRECTORY):
        print("Loading existing vector database...")
        vector_db = FAISS.load_local(PERSIST_DIRECTORY, embedding, allow_dangerous_deserialization=True)
        print("Vector database loaded.")
        logging.info("Loaded existing vector database.")
    else:
        print("Creating new vector database...")
        # Load and process the text document
        data, _ = read_document(DOC_PATH)
        python_splitter = character.RecursiveCharacterTextSplitter.from_language(
            language=base.Language.PYTHON
            )
        python_splits = python_splitter.split_text(data)
        vector_db = FAISS.from_texts(python_splits, embedding)
        vector_db.save_local(PERSIST_DIRECTORY)
        logging.info("Vector database created and persisted.")

    return vector_db

def create_retriever(vector_db, llm):
    """Create a multi-query retriever."""
    QUERY_PROMPT = PromptTemplate(
        input_variables=["question"],
        template="""You are an AI language model assistant. Your task is to generate five
different versions of the given user question to retrieve relevant documents from
a vector database. By generating multiple perspectives on the user question, your
goal is to help the user overcome some of the limitations of the distance-based
similarity search. Provide these alternative questions separated by newlines.
Original question: {question}""",
    )

    print("in create_retriever")
    retriever = MultiQueryRetriever.from_llm(
        vector_db.as_retriever(), llm, prompt=QUERY_PROMPT
    )
    print(retriever)
    print("retriever created")
    logging.info("Retriever created.")
    # retriever = vector_db.as_retriever(
    #         search_type="similarity",  # Also test "similarity", "mmr"
    #         search_kwargs={"k": 5}
    #         )
    return retriever


def create_chain(retriever, llm):
    """Create the chain with preserved syntax."""
    # RAG prompt
#     template = """Answer the question based ONLY on the following context:
# {context}
# Question: {question}
# """

    template = """You are a coding generator with expertise in using tskit toolkit for analysing tree-sequences. \n 
                    Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Use the tskit module to answer the user 
                    question based on the above provided documentation. Ensure any code you provide should be a callable function and can be executed \n 
                    with all required imports and variables defined. Structure your answer with a description of the code solution. \n
                    Then list the imports. And finally list the functioning code block. Maintain this order. The function should return a string providing the answer. Here is the user question: {question}"""

    prompt = ChatPromptTemplate.from_template(template)

    print("in create_chain")
    chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    print("chain created")

    logging.info("Chain created with preserved syntax.")
    return chain


def main():
    st.title("Ollama Llama 3.2 - Code Generator RAG Test")

    # User input
    user_input = st.text_input("Enter your question:", "")

    if user_input:
        with st.spinner("Generating response..."):
            try:
                # Initialize the language model
                print("Loading language model...")
                llm = ChatOllama(model=MODEL_NAME)

                # Load the vector database
                print("Loading vector database...")
                vector_db = load_vector_db()
                if vector_db is None:
                    st.error("Failed to load or create the vector database.")
                    return

                # Create the retriever
                print("Creating retriever...")
                retriever = create_retriever(vector_db, llm)

                # Create the chain
                print("Creating chain...")
                chain = create_chain(retriever, llm)

                # Get the response
                print("Invoking chain...")
                response = chain.invoke(input=user_input)

                st.markdown("**Assistant:**")
                st.write(response)
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
    else:
        st.info("Please enter a question to get started.")

if __name__ == "__main__":
    main()