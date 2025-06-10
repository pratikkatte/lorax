# tskit_document_extractor.py
import requests
from lorax.chat.retriever.chunker import CodeChunker
from tree_sitter_languages import get_parser
import marko
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from langchain.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
import pickle
import sys
import os

def extract_documents_from_url(input_url: str):
    response = requests.get(input_url)
    html = marko.convert(response.text)
    soup = BeautifulSoup(html, "html.parser")
    article = soup.find_all('article')
    documents = []

    if article:
        for section in article[0].find_all('section', recursive=False):
            section_id = section.get('id')
            header = section.find('h1') or section.find('h2')
            paragraph = section.find('p')
            content = ""
            if header:
                content += header.get_text(strip=True) + " "
            if paragraph:
                content += paragraph.get_text(strip=True)

            if content:
                documents.append(Document(
                    page_content=content,
                    metadata={"title": header.get_text(strip=True) if header else "", 'type': 'text'}
                ))

            for subsection in section.find_all('section', recursive=True):
                subheader = (subsection.find('h2') or subsection.find('h3') or
                             subsection.find('h4') or subsection.find('h5'))
                if subheader:
                    title = subheader.get_text(strip=True)
                    subparagraph = subsection.find('p')
                    sub_content = subparagraph.get_text(strip=False) if subparagraph else ""
                    if sub_content:
                        documents.append(Document(
                            page_content=sub_content,
                            metadata={"title": title, 'type': 'text'}
                        ))

                tables = subsection.find_all('table')
                dls = subsection.find_all('dl')

                if dls and not tables:
                    for dl in dls:
                        dt = dl.find('dt')
                        if dt:
                            dl_title = dt.get_text(strip=True)
                            dl_text = dl.get_text(strip=False)
                            documents.append(Document(
                                page_content=dl_text,
                                metadata={"title": dl_title, 'type': 'code'}
                            ))

                if tables:
                    for table in tables:
                        rows = table.find('tbody').find_all('tr')
                        for row in rows:
                            cells = row.find_all('td')
                            if len(cells) == 2:
                                property_name = cells[0].get_text(strip=True)
                                description = cells[1].get_text(strip=True)
                                table_paragraph = f"{property_name}: {description}. "
                                documents.append(Document(
                                    page_content=table_paragraph,
                                    metadata={"title": property_name, 'type': 'code'}
                                ))

    return documents

def create_document(input_url, log=False, ignore_first_section=True):
    documents = []
    response = requests.get(input_url)
    html = marko.convert(response.text)
    soup = BeautifulSoup(html, "html.parser")
    sections = soup.find_all(["h1", 'h2','h3'])
    for section in sections[1:]:
        section_title = section.get_text()
        if log:
            print(section_title)
        text = ''
        for elem in section.find_next_siblings():
            if elem.name in ["h3"]:
                break
            text += str(elem)

        chunks = text.split("</pre>")
        for chunk in chunks:
            document = Document(
                page_content=chunk,
                metadata={"title": section_title}
            )            
            documents.append(document)
    return documents

def extract_function_name(code):
    parser = get_parser("python")
    tree = parser.parse(bytes(code, "utf-8"))
    
    def traverse(node):
        if node.type == "function_definition":
            for child in node.children:
                if child.type == "identifier":
                    return code[child.start_byte:child.end_byte]
        for child in node.children:
            result = traverse(child)
            if result:
                return result
        return None
    
    return traverse(tree.root_node)

def codeChunking(input_urls):
    chunker = CodeChunker(file_extension='py', encoding_name='gpt-4')
    all_chunk = []
    for url in input_urls:
        response = requests.get(url)
        data = response.text
        chunks = chunker.chunk(data, token_limit=25)
        for chunk in chunks.values():
            all_chunk.append(chunk)

    documents = []
    for chunk in all_chunk:
        title = extract_function_name(chunk)
        documents.append(Document(
            page_content=chunk,
            metadata={"title": title, 'type': 'code'}
        ))    
    return documents

def saveDocuments(documents, document_name='data/documents.pkl'):

    if len(documents)>0:
        with open(document_name, 'wb') as f:
            pickle.dump(documents, f)
    else:
        print("ERROR: Couldn't save document. Documents empty")


def createFaissVector(documents=None, documents_path=None, to_save=None):
    if documents_path:
        with open(documents_path, 'r') as file:
            all_documents = pickle.load(file)
    else:
        all_documents = documents

    if all_documents is not None:
        embeddings = OllamaEmbeddings(model="nomic-embed-text")
        vector_store = FAISS.from_documents(
            documents=documents,
            embedding=embeddings
        )
        vector_store.save_local(folder_path=to_save, index_name="faiss_index")
        return vector_store
    else:
        print("ERROR: Documents None")

def createDocs(create_faiss=False, to_return=False):
    input_url = "https://tskit.dev/tskit/docs/stable/python-api.html"

    python_code_urls = [
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/combinatorics.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/drawing.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/exceptions.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/formats.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/genotypes.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/intervals.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/metadata.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/provenance.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/stats.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/tables.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/text_formats.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/trees.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/util.py",
        "https://raw.githubusercontent.com/tskit-dev/tskit/refs/heads/main/python/tskit/vcf.py"
    ]

    doc_urls = [
        "https://tskit.dev/tutorials/_sources/what_is.md",
        "https://tskit.dev/tutorials/_sources/terminology_and_concepts.md",
        "https://tskit.dev/tutorials/_sources/getting_started.md",
        "https://tskit.dev/tutorials/_sources/analysing_tree_sequences.md",
        "https://tskit.dev/tutorials/_sources/analysing_trees.md",
        "https://tskit.dev/tutorials/_sources/incremental_algorithms.md",
        "https://tskit.dev/tutorials/_sources/counting_topologies.md",
        "https://tskit.dev/tutorials/_sources/parallelization.md",
        "https://tskit.dev/tutorials/_sources/tables_and_editing.md",
        "https://tskit.dev/tutorials/_sources/viz.md",
        "https://tskit.dev/tutorials/_sources/metadata.md",
        "https://tskit.dev/tutorials/_sources/args.md",
        "https://tskit.dev/tutorials/_sources/simulation_overview.md",
        "https://tskit.dev/tutorials/_sources/no_mutations.md",
        "https://tskit.dev/tutorials/_sources/demography.md",
        "https://tskit.dev/tutorials/_sources/bottlenecks.md",
        "https://tskit.dev/tutorials/_sources/introgression.md",
        "https://tskit.dev/tutorials/_sources/completing_forward_sims.md",
        "https://tskit.dev/tutorials/_sources/forward_sims.md",
        "https://tskit.dev/tutorials/_sources/more_forward_sims.md",
        "https://tskit.dev/tutorials/_sources/popgen.md",
        "https://tskit.dev/tutorials/_sources/phylogen.md"
    ]


    ref_documents = extract_documents_from_url(input_url)
    python_documents = codeChunking(python_code_urls)

    tutorial_docs = []
    for url in doc_urls:
        tutorial_docs.extend(create_document(url))

    all_documents = ref_documents + python_documents + tutorial_docs

    saveDocuments(all_documents)

    if create_faiss:
        createFaissVector(documents=all_documents)
    
    print(f"Extracted {len(all_documents)} documents")
    if to_return:
        return all_documents

if __name__ == "__main__":
    createDocs(True, False)
