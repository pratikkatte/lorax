# Treesequence_LLM_Viz
Query based Code Generation and Analysis of Tree-Sequence using LLM.

### Goal
The goal is to leverage Large-language Models(LLM) to generate code and analyze tree-sequences using tskit by simply asking questions in plain English. With Retrieval-Augmented Generation (RAG), users can input questions in plain English, and the system will generate executable tskit code to answer these queries. 

### Current Version:
In this initial proof-of-concept, the tskit source code is used as a knowledge base for the Large Language Model (LLM). When users input queries in natural language, the LLM generates the appropriate code based on the knowledge and returns a python function as a response. 

Current version is a naive ```prompt:answer``` approach which does not evaluate the accuracy of the generated code. 

### Next things to do.
- [x] Code generation can be improved using [Flow Engineering Approach](https://arxiv.org/pdf/2401.08500). Use LangGraph and openai Function Calling to setup the workflow. 
  ![alt text](assets/image.png)
- [x] Code execution with error checking.
- [x] Multiple Iterations.
- [x] Terminal chat interface / UI interface (flask-reactjs)
- [ ] human-in-the-loop. (human intervention to review the code or correct it.)
- [ ] Additional node(tool) to ask general tree-sequence question that are not related to code-generation.
- [ ] Accuracy/reliability of the generated answer.

### Exploration
-  How to enhance treesequence analysis. one way is [MemoRAG](https://github.com/qhjqhj00/MemoRAG). Memory-based knowledge discovery for long contexts. 

