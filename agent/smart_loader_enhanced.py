#################
# Imports
##################
import os
import re
import ast
from typing import List, Optional
from dotenv import load_dotenv
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    Language,
    MarkdownHeaderTextSplitter,
)
from langchain_core.documents import Document

# Load environment variables
load_dotenv()


#################
# Helper Functions
#################

def split_by_file_headers(content: str) -> List[dict]:
    """
    Split a multi-file document by the --- header --- markers.
    Returns a list of dicts with 'path' and 'content' keys.
    """
    header_pattern = r'^---\s+(.+?)\s+---\s*$'

    files = []
    current_file = None
    current_content = []

    for line in content.split('\n'):
        header_match = re.match(header_pattern, line)

        if header_match:
            if current_file is not None:
                files.append({
                    'path': current_file,
                    'content': '\n'.join(current_content).strip()
                })
            current_file = header_match.group(1)
            current_content = []
        else:
            if current_file is not None:
                current_content.append(line)

    if current_file is not None:
        files.append({
            'path': current_file,
            'content': '\n'.join(current_content).strip()
        })

    return files


def get_language_from_path(file_path: str) -> str:
    """Determine the programming language from file extension."""
    extension_map = {
        '.py': 'python',
        '.md': 'markdown',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.js': 'js',
        '.ts': 'typescript',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.rst': 'rst',
        '.txt': 'text',
    }

    _, ext = os.path.splitext(file_path)
    return extension_map.get(ext.lower(), 'text')


def extract_python_structure(content: str) -> dict:
    """
    Extract class and function names from Python code.
    Returns a dict mapping line numbers to names.
    """
    structure = {}
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                # Line number to name mapping
                structure[node.lineno] = {
                    'type': 'class' if isinstance(node, ast.ClassDef) else 'function',
                    'name': node.name
                }
    except SyntaxError:
        # If code has syntax errors, skip structure extraction
        pass
    return structure


def find_containing_definition(content: str, chunk_content: str, structure: dict) -> Optional[dict]:
    """
    Given a chunk, find which function/class it belongs to.
    """
    # Find where this chunk starts in the original content
    chunk_start = content.find(chunk_content)
    if chunk_start == -1:
        return None

    # Count line number
    line_num = content[:chunk_start].count('\n') + 1

    # Find the closest definition before this line
    best_match = None
    for def_line, def_info in sorted(structure.items()):
        if def_line <= line_num:
            best_match = def_info
        else:
            break

    return best_match


def process_python_file(file_path: str, content: str, chunk_size: int, chunk_overlap: int) -> List[Document]:
    """
    Process a Python file with enhanced metadata including function/class names.
    """
    # Extract code structure
    structure = extract_python_structure(content)

    # Create initial document
    doc = Document(
        page_content=content,
        metadata={'source': file_path, 'language': 'python'}
    )

    # Split with Python-aware splitter
    splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    chunks = splitter.split_documents([doc])

    # Enhance each chunk with structure information
    for chunk in chunks:
        definition = find_containing_definition(content, chunk.page_content, structure)
        if definition:
            chunk.metadata['contains_type'] = definition['type']
            chunk.metadata['contains_name'] = definition['name']

    return chunks


def process_markdown_file(file_path: str, content: str, chunk_size: int, chunk_overlap: int) -> List[Document]:
    """
    Process a Markdown file with header hierarchy metadata.
    """
    # Define headers to track
    headers_to_split_on = [
        ("#", "h1"),
        ("##", "h2"),
        ("###", "h3"),
        ("####", "h4"),
    ]

    # First, split by headers to capture hierarchy
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False  # Keep headers in content for context
    )

    try:
        header_chunks = header_splitter.split_text(content)
    except Exception:
        # Fallback if header splitting fails
        header_chunks = [Document(page_content=content, metadata={})]

    # Add source and language to all chunks
    for chunk in header_chunks:
        chunk.metadata['source'] = file_path
        chunk.metadata['language'] = 'markdown'

    # If chunks are too large, split them further while preserving header metadata
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    final_chunks = []
    for chunk in header_chunks:
        if len(chunk.page_content) > chunk_size:
            # Split further while preserving metadata
            sub_chunks = text_splitter.split_documents([chunk])
            final_chunks.extend(sub_chunks)
        else:
            final_chunks.append(chunk)

    return final_chunks


def process_generic_file(file_path: str, content: str, language: str, chunk_size: int, chunk_overlap: int) -> List[Document]:
    """
    Process files with generic splitter.
    """
    doc = Document(
        page_content=content,
        metadata={'source': file_path, 'language': language}
    )

    if language in ['c', 'cpp', 'js', 'typescript', 'java', 'go', 'rust', 'ruby']:
        try:
            lang_enum = Language[language.upper()]
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=lang_enum,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
        except KeyError:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
    else:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

    return splitter.split_documents([doc])


def process_multi_file_document(file_path: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Document]:
    """
    Load a multi-file document with enhanced metadata.

    Enhanced metadata includes:
    - source: Original file path
    - language: Detected programming language
    - For Python: contains_type, contains_name (function/class info)
    - For Markdown: h1, h2, h3, h4 (header hierarchy)
    """
    print(f"Loading document from: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    print("\nSplitting document by file boundaries...")
    files = split_by_file_headers(content)
    print(f"✓ Found {len(files)} individual files in document")

    all_chunks = []
    language_stats = {}

    for file_info in files:
        path = file_info['path']
        content = file_info['content']

        if not content:
            continue

        language = get_language_from_path(path)
        language_stats[language] = language_stats.get(language, 0) + 1

        # Use specialized processors for better metadata
        if language == 'python':
            chunks = process_python_file(path, content, chunk_size, chunk_overlap)
        elif language == 'markdown':
            chunks = process_markdown_file(path, content, chunk_size, chunk_overlap)
        else:
            chunks = process_generic_file(path, content, language, chunk_size, chunk_overlap)

        all_chunks.extend(chunks)

    print("\n" + "=" * 50)
    print("PROCESSING SUMMARY")
    print("=" * 50)
    print(f"Total files processed: {len(files)}")
    print(f"Total chunks created: {len(all_chunks)}")
    print("\nLanguage breakdown:")
    for lang, count in sorted(language_stats.items()):
        print(f"  {lang}: {count} files")

    return all_chunks


#################
# Main Code
#################
def main():
    print("=" * 50)
    print("Enhanced Multi-Language Document Loader")
    print("=" * 50)
    print("\nThis version adds rich metadata:")
    print("  - Python: function/class names")
    print("  - Markdown: header hierarchy")
    print("  - All: source file path & language")

    doc_path = "data-new.txt"

    if not os.path.exists(doc_path):
        print(f"\n✗ File not found: {doc_path}")
        return

    chunks = process_multi_file_document(
        doc_path,
        chunk_size=1000,
        chunk_overlap=200
    )

    # Display sample chunks with metadata
    print("\n" + "=" * 50)
    print("SAMPLE CHUNKS WITH METADATA")
    print("=" * 50)

    # Show Python chunk
    python_chunks = [c for c in chunks if c.metadata.get('language') == 'python']
    if python_chunks:
        print("\n[Python Chunk Example]")
        chunk = python_chunks[0]
        print(f"Metadata: {chunk.metadata}")
        print(f"Content preview: {chunk.page_content}...")

    # Show Markdown chunk
    markdown_chunks = [c for c in chunks if c.metadata.get('language') == 'markdown']
    if markdown_chunks:
        print("\n[Markdown Chunk Example]")
        chunk = markdown_chunks[0]
        print(f"Metadata: {chunk.metadata}")
        print(f"Content preview: {chunk.page_content}...")

    # Show metadata variety
    print("\n" + "=" * 50)
    print("METADATA FIELDS FOUND")
    print("=" * 50)

    all_metadata_keys = set()
    for chunk in chunks:
        all_metadata_keys.update(chunk.metadata.keys())

    print("Available metadata fields:")
    for key in sorted(all_metadata_keys):
        print(f"  - {key}")

    print("\n" + "=" * 50)
    print("✓ Enhanced metadata demo complete!")
    print("=" * 50)

    return chunks


if __name__ == "__main__":
    main()
