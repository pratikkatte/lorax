#################
# Imports
##################
import os
from typing import List, Optional
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_core.documents import Document
import faiss

from smart_loader_enhanced import process_multi_file_document

# Load environment variables
load_dotenv()


#################
# VectorStore Class
#################
class DocumentVectorStore:
    """
    A class to manage document vector stores using FAISS.

    Handles loading documents, creating embeddings, and querying.
    Automatically loads existing vector stores or creates new ones.
    """

    def __init__(
        self,
        store_path: str = "vector_store",
        embedding_model: str = "text-embedding-3-small",
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ):
        """
        Initialize the DocumentVectorStore.

        Args:
            store_path: Path where the vector store is saved/loaded
            embedding_model: OpenAI embedding model to use
            chunk_size: Size of text chunks for splitting
            chunk_overlap: Overlap between chunks
        """
        self.store_path = store_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings(model=embedding_model)

        # Vector store (will be loaded or created)
        self.vectorstore: Optional[FAISS] = None

    def load_or_create(self, document_path: Optional[str] = None) -> None:
        """
        Load existing vector store or create a new one from documents.

        Args:
            document_path: Path to document file (required if creating new store)
        """
        if os.path.exists(self.store_path):
            self._load_existing()
        else:
            if document_path is None:
                raise ValueError(
                    f"No vector store found at '{self.store_path}' and no document_path provided. "
                    "Please provide document_path to create a new vector store."
                )
            self._create_new(document_path)

    def _load_existing(self) -> None:
        """Load an existing vector store from disk."""
        self.vectorstore = FAISS.load_local(
            self.store_path,
            self.embeddings,
            allow_dangerous_deserialization=True
        )

    def _create_new(self, document_path: str) -> None:
        """Create a new vector store from documents."""
        # Load and process documents with enhanced metadata
        documents = process_multi_file_document(
            document_path,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap
        )

        # Determine embedding dimension
        embedding_dim = len(self.embeddings.embed_query("test"))

        # Create FAISS index
        index = faiss.IndexFlatL2(embedding_dim)

        # Initialize empty vector store
        self.vectorstore = FAISS(
            embedding_function=self.embeddings,
            index=index,
            docstore=InMemoryDocstore(),
            index_to_docstore_id={},
        )

        # Add documents in batches
        batch_size = 500
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            self.vectorstore.add_documents(batch)

        # Save to disk
        self.vectorstore.save_local(self.store_path)

    def search(self, query: str, k: int = 4) -> List[Document]:
        """
        Search for relevant documents.

        Args:
            query: Search query
            k: Number of results to return

        Returns:
            List of relevant documents with metadata
        """
        if self.vectorstore is None:
            raise RuntimeError("Vector store not initialized. Call load_or_create() first.")

        retriever = self.vectorstore.as_retriever(search_kwargs={"k": k})
        return retriever.invoke(query)

    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """
        Alias for search() method.

        Args:
            query: Search query
            k: Number of results to return

        Returns:
            List of relevant documents with metadata
        """
        return self.search(query, k)

    def add_documents(self, documents: List[Document]) -> None:
        """
        Add new documents to the vector store.

        Args:
            documents: List of Document objects to add
        """
        if self.vectorstore is None:
            raise RuntimeError("Vector store not initialized. Call load_or_create() first.")

        self.vectorstore.add_documents(documents)
        self.vectorstore.save_local(self.store_path)

    def delete_store(self) -> None:
        """Delete the vector store from disk."""
        import shutil
        if os.path.exists(self.store_path):
            shutil.rmtree(self.store_path)
            self.vectorstore = None

    def rebuild(self, document_path: str) -> None:
        """
        Rebuild the vector store from scratch.

        Args:
            document_path: Path to document file
        """
        self.delete_store()
        self._create_new(document_path)

    def get_retriever(self, k: int = 4):
        """
        Get a LangChain retriever interface.

        Args:
            k: Number of results to return

        Returns:
            LangChain retriever object
        """
        if self.vectorstore is None:
            raise RuntimeError("Vector store not initialized. Call load_or_create() first.")

        return self.vectorstore.as_retriever(search_kwargs={"k": k})


#################
# Example Usage
#################
if __name__ == "__main__":
    # Example 1: Create or load vector store
    print("=" * 50)
    print("DocumentVectorStore Example")
    print("=" * 50)

    # Initialize vector store
    store = DocumentVectorStore(
        store_path="tskit_vectorstore_class",
        chunk_size=1000,
        chunk_overlap=200
    )

    # Load existing or create new
    print("\nLoading or creating vector store...")
    try:
        store.load_or_create(document_path="data-new.txt")
        print("✓ Vector store ready")
    except Exception as e:
        print(f"✗ Error: {e}")
        exit(1)

    # Example 2: Search
    print("\n" + "=" * 50)
    print("Search Example")
    print("=" * 50)

    query = "node defenition"
    print(f"\nQuery: {query}")
    results = store.search(query, k=5)

    print(f"\nFound {len(results)} results:")
    for i, doc in enumerate(results, 1):
        print(f"\n[Result {i}]")
        print(f"Metadata: {doc.metadata}")
        print(f"Content preview: {doc.page_content[:]}...")

    # Example 3: Using retriever interface
    print("\n" + "=" * 50)
    print("Retriever Interface Example")
    print("=" * 50)

    retriever = store.get_retriever(k=4)
    results = retriever.invoke("How do I create a tree?")
    print(f"\nFound {len(results)} results using retriever interface")

    print("\n" + "=" * 50)
    print("✓ Examples complete")
    print("=" * 50)
