# Import Packages
import os
import time
import json
from pydantic import BaseModel, Field
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import character, base
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain.prompts import ChatPromptTemplate
from pkg_resources import resource_filename
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import ollama

# Define Variables
DOC_PATH = "./data-new.txt"
MODEL_NAME = "llama3.2:1b"
EMBEDDING_MODEL = "nomic-embed-text"
PERSIST_DIRECTORY = './tskit-vector-ollama'


# === Pydantic Code Schema ===
class Code(BaseModel):
    prefix: str = Field(description="Description of the problem and approach")
    imports: str = Field(description="Required import statements")
    code: str = Field(description="Python code block as a function taking file_path")


# === Load document ===
def read_document(file_path):
    with open(file_path, 'r') as file:
        return file.read()


# === Create vector retriever ===
def create_retriever():
    embedding = OllamaEmbeddings(model=EMBEDDING_MODEL, temperature=0)

    data_file_path = resource_filename(__name__, 'data-new.txt')
    vector_store_path = resource_filename(__name__, 'tskit-vector')

    if os.path.exists(vector_store_path):
        print("Loading existing vector database...")
        vector_db = FAISS.load_local(vector_store_path, embedding, allow_dangerous_deserialization=True)
    else:
        print("Creating new vector database...")
        data = read_document(data_file_path)
        python_splitter = character.RecursiveCharacterTextSplitter.from_language(
            language=base.Language.PYTHON
        )
        python_splits = python_splitter.split_text(data)
        vector_db = FAISS.from_texts(python_splits, embedding)
        vector_db.save_local(vector_store_path)

    return vector_db.as_retriever(search_type="similarity", search_kwargs={"k": 5})


# === Code Generation Chain ===
def generate_code_chain(retriever, input_query):
    print("Retrieving context...")
    docs = retriever.invoke(input_query)
    context = "\n".join([doc.page_content for doc in docs])

    prompt_template = ChatPromptTemplate.from_template(
        """You are a Python coding generator with expertise in using tskit toolkit for analysing tree-sequences. \n 
        Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Use the tskit module to answer the user 
        question based on the above provided documentation. Ensure any code you provide should be a callable function and can be executed \n 
        with all required imports and variables defined. Structure your answer with a description of the code solution. \n
        Do not give example usage, simply create a function that is callable with a tree file as an input. \n
        Then list the imports. And finally list the functioning code block. The function should return a string providing the answer. Maintain this order which is: \n
        1. Prefix (code description and helpful information about the tree sequence)\n
        2. Imports (required code imports like tskit, to run the code in Python, write them as import statements)\n
        3. Code (code block which is a callable function with a tree sequence file as an input parameter, does not include import statements, make sure the code block returns an answer to the user's question)\n
        Here is the user question: {question}"""
    )

    prompt = prompt_template.format(context=context, question=input_query)

    print("Calling Ollama with structured code format...")
    start = time.time()
    response = ollama.chat(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL_NAME,
        format=Code.model_json_schema(),  # Ensures response matches `Code`
        options={'temperature': 0}
    )
    total = time.time() - start
    print(f"Code generation completed in {total:.2f} seconds.")

    print("\n=== Raw Response from Ollama ===")
    print(response)

    # Try parsing the response
    try:
        parsed = Code.model_validate_json(response['message']['content'])
        print("\n=== Structured Code Response ===")
        print("\nDescription:\n", parsed.prefix)
        print("\nImports:\n", parsed.imports)
        print("\nCode:\n", parsed.code)
    except Exception as e:
        print("\nError parsing model output:", e)
        print("Raw response:\n", response)

    return response


# === Setup ===
def setup_llm_and_retriever():
    print("Loading LLM and retriever...")
    llm = ChatOllama(model=MODEL_NAME, temperature=0)
    retriever = create_retriever()
    return llm, retriever


# === Main Chat Loop ===
def main():
    _, retriever = setup_llm_and_retriever()

    while True:
        user_input = input("\nEnter your question (or 'exit' to quit): ")

        if user_input.lower().strip() == "exit":
            print("Exiting.")
            break
        elif user_input.strip() == "":
            print("Please enter a valid question.")
        else:
            generate_code_chain(retriever, user_input)


if __name__ == "__main__":
    main()
