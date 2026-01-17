# tskit RAG Agent

A Retrieval-Augmented Generation (RAG) agent for answering questions about the tskit library using its documentation.

## Overview

This project implements a conversational RAG system that:
- Retrieves relevant documentation from a vector store
- Grades document relevance to user questions
- Rewrites questions when retrieved documents aren't relevant
- Generates concise answers based on retrieved context

## Files

- **rag_agent_loop.py** - Interactive CLI agent for conversational Q&A
- **rag_agent_testing.py** - Testing script for single-query evaluation
- **data-new.txt** - Source documentation text file
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
- `quit` or `exit` - End the session
- `clear` - Start a new conversation (clears message history)

Example session:
```
You: What is a tree sequence?

Agent: A tree sequence is a data structure that efficiently stores genetic genealogies...

You: How do I create one?

Agent: You can create a tree sequence using...
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

### RAG Pipeline

1. **Query Generation** - User asks a question
2. **Retrieval** - System searches vector store for relevant documentation
3. **Grading** - LLM grades whether retrieved docs are relevant
4. **Decision**:
   - If relevant → Generate answer
   - If not relevant → Rewrite question and retry retrieval
5. **Answer Generation** - Produce concise answer from context

### Vector Store

On first run, the system:
- Loads `data-new.txt`
- Splits text into chunks (1000 chars, 200 overlap)
- Creates embeddings using OpenAI's `text-embedding-3-small`
- Saves to `tskit_vectorstore_class/` directory

Subsequent runs load the existing vector store for faster startup.

## Architecture

The agent uses LangGraph to orchestrate:
- **generate_query_or_respond** - Decides to retrieve or answer directly
- **retrieve** - Fetches relevant documents
- **grade_documents** - Assesses document relevance
- **rewrite_question** - Reformulates unclear queries
- **generate_answer** - Creates final response

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

## Notes

- First run may take several minutes to build the vector store
- The vector store is cached in `tskit_vectorstore_class/` for reuse
- Interactive mode maintains conversation context across questions
- Testing mode shows detailed agent execution flow
