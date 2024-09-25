import os

from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import character, base

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import RetrievalQA
import re


# To create data.txt
def repo_to_text(path, output_file):

    with open(output_file, 'w', encoding='utf-8') as file:
        for root, dirs, files in os.walk(path):
            for filename in files:
                if filename.endswith(".py"):
                    filepath = os.path.join(root, filename)
                    file.write(f"\n\n--- {filepath} ---\n\n")
                    with open(filepath, 'r') as f:
                        content = f.read()
                        file.write(content)
        print(f"Content written to {output_file}")

# # Example usage
# output_file_path = 'data.text'
# repo_to_text("tskit", output_file_path)



def process(data, embeddings):
    python_splitter = character.RecursiveCharacterTextSplitter.from_language(
        language=base.Language.PYTHON, chunk_size=50, chunk_overlap=0
    )
    python_docs = python_splitter.create_documents([data])
    text_embeddings = embeddings.embed_documents([data])

    text_embedding_pairs = zip(data, text_embeddings)
    db = FAISS.from_embeddings(text_embedding_pairs, embeddings)
    return db

# if data exists
if os.path.isfile('data.text'):
    print('reading')
    with open('data.text', 'r') as file:
        data = file.read()
else:
    print("File does not exist.")


embeddings = OpenAIEmbeddings(openai_api_key="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")

if os.path.exists('faiss_index'):
    db = FAISS.load_local("faiss_index", embeddings, allow_dangerous_deserialization=True)
else:
    db = process(data, embeddings)
    db.save_local("faiss_index")

retriever = db.as_retriever(
    search_type="similarity",  # Also test "similarity", "mmr"
    search_kwargs={"k": 5},)

def parse_result(input_result):
    code_block = input_result.split('```')[1].replace('python','')
    return code_block

code_llm = ChatOpenAI(model="gpt-4", organization="org-N2oYJymjmrdzDGaWIRX70FLf", openai_api_key="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", temperature=0)
prompt_RAG = """
    You are a proficient python developer. Respond with the syntactically correct code for to the question below. Make sure you follow these rules:
    1. Use context to understand the APIs and how to use it & apply.
    2. Do not add license information to the output code.
    3. Do not include colab code in the output.
    4. Ensure all the requirements in the question are met.

    Question:
    {question}

    Context:
    {context}

    Helpful Response :
    Generate Python function:
    """

prompt_RAG_tempate = PromptTemplate(
    template=prompt_RAG, input_variables=["context", "question"]
)

qa_chain = RetrievalQA.from_llm(
    llm=code_llm, prompt=prompt_RAG_tempate, retriever=retriever, return_source_documents=True
)
user_question = "given a tree sequence calculate the diversity"

response = qa_chain({"query": user_question})
result = response['result']
print("generated code",  parse_result(result))


# while True:  # Start an infinite loop for the chat interface
#     user_question = input("You: ")  # Get user input from the command line
#     if user_question.lower() in ['exit', 'quit']:  # Allow user to exit the chat
#         print("Exiting chat. Goodbye!")
#         break

#     response = code_llm.predict(text=user_question, temperature=0.1)  # Get response from the model
#     print(f"Response: {response}")  # Print the model's response


