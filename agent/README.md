# tskit RAG Agent

A Retrieval-Augmented Generation (RAG) agent for answering questions about the tskit library and generating Python code using its API documentation.

## Overview

This project implements a conversational RAG system with two capabilities:

### Q&A Mode
- Retrieves relevant documentation from a vector store
- Grades document relevance to user questions
- Rewrites questions when retrieved documents aren't relevant
- Generates concise answers based on retrieved context

### Code Generation Mode
- Navigates the tskit Python API documentation using table of contents
- Retrieves relevant API method signatures and documentation
- Generates working Python code (20-50 lines) with imports and error handling
- Uses exact API signatures from official documentation

## Files

- **rag_agent_loop.py** - Interactive CLI agent for Q&A and code generation
- **api_navigator.py** - Parses and navigates the Python API documentation by sections
- **vector_store.py** - Vector store wrapper for document retrieval
- **smart_loader_enhanced.py** - Document loading and chunking utilities
- **rag_agent_testing.py** - Testing script for single-query evaluation
- **data-new.txt** - Source documentation text file (general concepts and guides)
- **python-api.md** - Python API reference documentation (~13K lines, 101 sections)
- **environment.yml** - Conda environment specification
- **requirements.txt** - Python package dependencies

## Setup

### 1. Create Conda Environment

```bash
conda env create -f environment.yml
conda activate tskit-rag
```

Or manually:

```bash
conda create -n tskit-rag python=3.11
conda activate tskit-rag
pip install -r requirements.txt
```

### 2. Configure OpenAI API Key

Create a `.env` file in the project directory:

```bash
OPENAI_API_KEY=your_api_key_here
```

### 3. Prepare Documentation

Ensure `data-new.txt` exists in the project directory. This file contains the tskit documentation that will be indexed.

## Usage

### Interactive Mode (rag_agent_loop.py)

Run the interactive agent for multi-turn conversations:

```bash
python rag_agent_loop.py
```

Commands during interaction:

- Type your question naturally to get answers
- Request code generation by saying "generate code...", "write code...", etc.
- `quit` or `exit` - End the session
- `clear` - Start a new conversation (clears message history)

Example Q&A session:
```text
You: What is a tree sequence?

Agent: A tree sequence is a data structure that efficiently stores genetic genealogies...

You: How do I create one?

Agent: You can create a tree sequence using...
```

Example code generation session:

```text
You: Generate code to load a tree sequence and calculate diversity

[Agent thinking...]
[Browsing API documentation...]
[Generating code...]

Agent:
```python
import tskit

# Load tree sequence from file
ts = tskit.load("example.trees")

# Calculate diversity for all samples
diversity = ts.diversity()

print(f"Mean diversity: {diversity}")
```
```

### Testing Mode (rag_agent_testing.py)

Run a single test query to evaluate the RAG pipeline:

```bash
python rag_agent_testing.py
```

This script:
- Loads the vector store
- Runs a hardcoded test query (line 384-391)
- Shows the step-by-step agent workflow
- Displays updates from each node in the graph

To test different questions, modify the content field in [rag_agent_testing.py:389](rag_agent_testing.py#L389):

```python
"content": "What is a node in tskit?",  # Change this question
```

## How It Works

### Q&A Pipeline

1. **Query Generation** - User asks a question
2. **Retrieval** - System searches vector store for relevant documentation
3. **Grading** - LLM grades whether retrieved docs are relevant
4. **Decision**:
   - If relevant → Generate answer
   - If not relevant → Rewrite question and retry retrieval
5. **Answer Generation** - Produce concise answer from context

### Code Generation Pipeline

1. **Intent Detection** - LLM recognizes code generation request
2. **API Navigation** - System presents table of contents from python-api.md
3. **Section Selection** - LLM selects relevant section IDs (e.g., "treesequence-api", "tskit.TreeSequence.diversity")
4. **Documentation Retrieval** - Retrieves complete sections with method signatures and parameters
5. **Code Generation** - LLM generates working Python code using exact API signatures
6. **Output** - Returns clean code with imports and comments (API docs discarded from conversation)

### Data Sources

**Q&A Mode:**

On first run, the system:

- Loads `data-new.txt` (general documentation, tutorials, concepts)
- Splits text into chunks (1000 chars, 200 overlap)
- Creates embeddings using OpenAI's `text-embedding-3-small`
- Saves to `tskit_vectorstore_class/` directory

Subsequent runs load the existing vector store for faster startup.

**Code Generation Mode:**

- Parses `python-api.md` into 101 sections on-the-fly
- Uses table of contents navigation (no embeddings needed)
- Retrieves exact API method documentation by section ID
- No persistent storage required

## Architecture

The agent uses LangGraph to orchestrate two parallel workflows:

### Q&A Path

- **generate_query_or_respond** - Decides to retrieve, generate code, or answer directly
- **retrieve** - Fetches relevant documents from vector store
- **grade_documents** - Assesses document relevance
- **rewrite_question** - Reformulates unclear queries
- **generate_answer** - Creates final response

### Code Generation Path

- **generate_query_or_respond** - Detects code generation intent
- **api_navigator** - Shows TOC, LLM selects sections, retrieves API docs
- **generate_code** - Generates Python code using retrieved API documentation

## Models Used

- **LLM**: GPT-4o (temperature=0 for consistent responses)
- **Embeddings**: text-embedding-3-small
- **Vector Store**: FAISS (CPU version)

## Troubleshooting

**Vector store creation fails:**

- Ensure `data-new.txt` exists and is readable
- Check OpenAI API key is valid
- Verify sufficient disk space

**API errors:**

- Confirm `.env` file contains valid `OPENAI_API_KEY`
- Check API quota/billing status

**Import errors:**

- Verify all packages installed: `pip list`
- Reinstall requirements: `pip install -r requirements.txt`

**Code generation not working:**

- Ensure `python-api.md` exists in the agent directory
- Check that requests explicitly mention "generate code", "write code", etc.
- Verify OpenAI API key has sufficient quota

## Notes

- First run may take several minutes to build the vector store
- The vector store is cached in `tskit_vectorstore_class/` for reuse
- Interactive mode maintains conversation context across questions
- Retrieved API documentation is discarded after code generation (only the generated code persists)
- Code generation uses TOC navigation, not vector search, for precise API lookups
- Testing mode (rag_agent_testing.py) only tests Q&A, not code generation
