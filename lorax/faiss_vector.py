import os 

from pkg_resources import resource_filename


from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

from langchain_text_splitters.character import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import Language
from langchain_text_splitters import character, base
from dotenv import load_dotenv

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


def getRetriever():
    """
    """
    embeddings = OpenAIEmbeddings()

    data_file_path = resource_filename(__name__, 'data-new.txt')
    tskit_file_path =  resource_filename(__name__, 'tskit-vector')


    if os.path.exists(tskit_file_path):
        vector_store = FAISS.load_local(tskit_file_path, embeddings, allow_dangerous_deserialization=True)
    else:
        data, _ = read_document(data_file_path)
        python_splitter = character.RecursiveCharacterTextSplitter.from_language(
            language=base.Language.PYTHON
            )
        python_splits = python_splitter.split_text(data)
        vector_store = FAISS.from_texts(python_splits, embeddings)
        vector_store.save_local(tskit_file_path)
    
    retriever = vector_store.as_retriever(
        search_type="similarity",  # Also test "similarity", "mmr"
        search_kwargs={"k": 5}
        )

    return retriever

# vector_store = get_vector_store()
