# Treesequence_LLM_Viz
Code Generation and Analysis of Tree-Sequence using LLM.

### Goal
The goal of the project aims to help researchers analyze and explore tree-sequences using tskit by simply asking questions in plain English. By leveraging a Large Language Model (LLM) with Retrieval-Augmented Generation (RAG), users can input questions in plain English, and the system will generate executable tskit code to answer these queries. The intent is to make working with tree-sequences easier and more intuitive, even if the user is not a coding expert!

### Current Version: What it does.
In this initial proof-of-concept, the tskit source code is used as a knowledge base for the Large Language Model (LLM). When users input queries in natural language, the LLM generates the appropriate tskit code based on this knowledge. The generated code is then executed to provide answers to the user's questions. This version is the basic proof-of-concept demonstrating the core-functionality to turn natural language quries into actionable tskit code for analyzing tree-sequences.

### How to Run. 
To install required dependencies
```
conda create -n treesequences
conda activate treesequences
pip install -r requirments.py
```
To test the program, run the following command:
```
python treeseqgen.py
```