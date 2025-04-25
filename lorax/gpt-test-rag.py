# Import Packages
import os
import logging
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import Language
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.retrievers.multi_query import MultiQueryRetriever
import ollama
from langchain_openai import OpenAIEmbeddings

# Define Variables
DOC_PATH = "./data-new.txt"
MODEL_NAME = "gpt-4o"  # or your Ollama model
# EMBEDDING_MODEL = "nomic-embed-text"
PERSIST_DIRECTORY = './tskit-vector-gpt'

# === Read & Split Document ===
def read_document(file_path):
    with open(file_path, 'r') as file:
        data = file.read()

    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, chunk_size=50, chunk_overlap=0
    )

    python_docs = python_splitter.create_documents([data])
    return data, python_docs

# === Load/Create Vector DB ===
def load_vector_db():
    # ollama.pull(EMBEDDING_MODEL)
    embedding = OpenAIEmbeddings()

    if os.path.exists(PERSIST_DIRECTORY):
        print("Loading existing vector database...")
        vector_db = FAISS.load_local(PERSIST_DIRECTORY, embedding, allow_dangerous_deserialization=True)
    else:
        print("Creating new vector database...")
        data, _ = read_document(DOC_PATH)
        python_splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.PYTHON, chunk_size=50, chunk_overlap=0
        )
        python_splits = python_splitter.split_text(data)
        vector_db = FAISS.from_texts(python_splits, embedding)
        vector_db.save_local(PERSIST_DIRECTORY)
        print("Vector DB created and saved.")
    
    return vector_db

# === Create Retriever ===
def create_retriever(vector_db):
#     query_prompt = PromptTemplate(
#         input_variables=["question"],
#         template="""You are an AI language model assistant. Your task is to generate five
# different versions of the given user question to retrieve relevant documents from
# a vector database. By generating multiple perspectives on the user question, your
# goal is to help the user overcome some of the limitations of the distance-based
# similarity search. Provide these alternative questions separated by newlines.
# Original question: {question}""",
#     )

#     print("Creating retriever...")
#     retriever = MultiQueryRetriever.from_llm(
#         vector_db.as_retriever(), llm, prompt=query_prompt
#     )
    return vector_db.as_retriever(search_type="similarity", search_kwargs={"k": 5})

# === Create Chain ===
def create_chain(retriever, llm):
    template = """You are a Python coding generator with expertise in using tskit toolkit for analysing tree-sequences. \n 
        Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Use the tskit module to answer the user 
        question based on the above provided documentation. Ensure the code you provide should be a callable function and can be executed \n 
        with all required imports and variables defined. Structure your answer with a description of the code solution. \n
        Do not give example usage, simply create a function that is callable with a tree sequence file path as an input. \n
        Then list the imports. And finally list the functioning code block. The function should return a string providing the answer. Maintain this order which is: \n
        1. Prefix (code description and helpful information about the tree sequence, try to be as informative as possible)\n
        2. Imports (required code imports like tskit, to run the code in Python, write them as import statements)\n
        3. Code (code block which is a callable function with a tree sequence file path as an input parameter, does not include import statements, make sure the code block returns an answer to the user's question which is callable and implements the desired solution)\n
        Here is the user question: {question}"""



    prompt = ChatPromptTemplate.from_template(template)

    chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain

# === CLI Main Function ===
def main():
    print("=== tskit Code Generator CLI ===\n")
    print(f"Using model: {MODEL_NAME}")

    # Load LLM (can switch to ChatOllama if needed)
    llm = ChatOpenAI(model_name=MODEL_NAME, temperature=0)

    # Load or create vector database
    vector_db = load_vector_db()

    # Create retriever and chain
    retriever = create_retriever(vector_db)
    chain = create_chain(retriever, llm)

    # Start CLI loop
    while True:
        question = input("\nEnter your question (or type 'exit' to quit): ")
        if question.strip().lower() == "exit":
            print("Exiting.")
            break
        elif not question.strip():
            print("Please enter a valid question.")
            continue

        print("\nGenerating response...")
        try:
            response = chain.invoke(input=question)
            print("\n=== Response ===\n")
            print(response)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
