# Treesequence_LLM_Viz
Query based Code Generation and Analysis of Tree-Sequence using LLM.

### Goal
The goal is to leverage Large-language Models(LLM) to generate code to analyze tree-sequences using tskit by simply asking questions in plain English. With Retrieval-Augmented Generation (RAG), users can input questions in plain English, and the system will generate executable tskit code to answer these queries. 

### Current Version: What it does.
In this initial proof-of-concept, the tskit source code is used as a knowledge base for the Large Language Model (LLM). When users input queries in natural language, the LLM generates the appropriate tskit code based on this knowledge.

### How to Run. 
To install required dependencies
```
conda create -n treesequences python=3.10
conda activate treesequences
pip install -r requirments.txt
```
To test the program, run the following command:
```
python tree_llm.py
```