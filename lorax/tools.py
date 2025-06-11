from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from langchain_core.prompts import PromptTemplate
from langchain.chains import ConversationChain
from dotenv import load_dotenv
from pkg_resources import resource_filename
import numpy as np
import ollama
import json
import time
import os
from typing import Optional, List, Dict, Any

from lorax.utils import code, execute_generated_code, response_parser, parse_output
from lorax.faiss_vector import getRetriever, rerank_documents

from langchain_tavily import TavilySearch

from langchain.agents import AgentExecutor, create_react_agent
from langchain_community.agent_toolkits.load_tools import load_tools
from lorax.models import Model
from lorax.prompts import Prompt
from lorax.react_agent import run
from langchain_community.retrievers import ArxivRetriever

load_dotenv()

COMPANY_NAME = "OPENAI"
MODEL_NAME = "gpt-4o"

ollama_client = None

general_llm = Model(model_name=MODEL_NAME, company=COMPANY_NAME)

retriever, reranker = getRetriever()

def visualizationTool(question, attributes=None):
    prompt_messages = Prompt(agent_type='visualization')
    question = prompt_messages + question 

    _ , newick_string_genome_position = generatorTool(question, attributes['file_path'])

    if type(newick_string_genome_position) == tuple:
        nwk_string, genomic_position = newick_string_genome_position
    else:
        nwk_string, genomic_position = newick_string_genome_position.split("\n")

    return nwk_string, genomic_position

def generatorTool(question, input_file_path=None):
    try:

        code_gen_prompt_text = Prompt(agent_type='code_generation')
        code_gen_prompt = ChatPromptTemplate.from_messages(code_gen_prompt_text)
        lm = Model(model_name=MODEL_NAME, company=COMPANY_NAME)

        try:
            # Retriever model
            docs = retriever.invoke(question)
            final_context = rerank_documents(question, reranker, docs, 3)
        except Exception as e:
            print("context Error:", e)

        if COMPANY_NAME=="OPENAI":
        
            structured_code_llm = lm.with_structured_output(code, include_raw=True)

            # Chain with output check
            code_chain_raw = (
                code_gen_prompt | structured_code_llm | parse_output
            )
    
            code_solution = code_chain_raw.invoke(
                {"context": final_context, "messages": [question]}
            )
            
        else:
            # client = ollama.Client(host=ollama_client)

            filled_prompt = code_gen_prompt.format(context=final_context, question=question)
            response = lm.chat(
                messages=[
                    {
                        'role': 'user',
                        'content': filled_prompt
                    }
                ],
                model=lm,
                options={'temperature': 0}
            )
            
            code_solution = response_parser(response.message.content)
        
        print(code_solution)
        if input_file_path:
            result = execute_generated_code(code_solution, input_file_path)
        else:
            result = "Couldn't execute the generated code. File Not Provided!"

        return code_solution, result
    except Exception as e:
        print("Tools Error:", e)
        return f"Found Error while processing your query", None

def routerTool(query, attributes=None):
    """
    """
    prompt_template = """
    Provide answer in 1 word (yes/no).
    If the question requires generating a code and using the given tressequence and tskit library in order to provide the answer, then respond with 'yes' else respond with 'no' 
    Respond appropriately based on the user's query: {query}
    """
    prompt = PromptTemplate(
        input_variables=['quert'], template=prompt_template
    )
    chain = prompt | general_llm

    router_conversation = ConversationChain(
        llm=chain, 
        memory=attributes["memory"]
    )
    
    answer = router_conversation.run(query)

    return answer

def generalInfoTool(question, attributes=None):
    """
    This function is used to get the general information about the tskit and treesequence.
    """

    try:
        start = time.time()
        answer = run(question, attributes["memory"])

        end = time.time()

        print("Time taken to answer the question:", end-start)


        return answer
    except Exception as e:
        return f"Found Error, {e}"

# Tskit Search Functionality
def search_tskit(query: str) -> Optional[str]:
    """
    Fetch tskit information for a given search query using FAISS vector and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query, title, and summary, or None if no result is found.
    """
    start = time.time()

    try:
        print(f"Searching Tskit Documentation for: {query}")

        try:
            # Retriever model
            docs = retriever.invoke(query)
            final_context = rerank_documents(query, reranker, docs, 5)
        except Exception as e:
            print("context Error:", e)

        final_context_parsed = "\n".join([doc.page_content.strip() for doc in final_context])

        if final_context_parsed:
            # Create a dictionary with query, title, and summary
            result = {
                "query": query,
                "title": "Tskit Retrieved Information",
                "summary": final_context_parsed
            }
            print(f"Successfully retrieved summary for: {query}")
            end = time.time()
            print(f"Time taken for tskit search: {end - start} seconds")
            return json.dumps(result, ensure_ascii=False, indent=2)
        else:
            print(f"No results found for query: {query}")
            return None

    except Exception as e:
        print(f"An error occurred while processing the Tskit query: {e}")
        return None

# Arxiv Search Functionality
def format_docs(docs):
    """Format documents for display."""
    return "\n\n".join(doc.page_content for doc in docs)

def search_arxiv(query: str) -> Optional[str]:
    """
    Fetch ArXiv information for a given search query using ArxivRetriever and return as JSON.

    Args:
        query (str): The search query string.

    Returns:
        Optional[str]: A JSON string containing the query and articles, or None if no result is found.
    """
    start = time.time()

    try:
        print(f"Searching Arxiv for: {query}")
        
        retriever = ArxivRetriever(
            load_max_docs=3,
            get_full_documents=True,
        )

        docs = retriever.invoke(query)
        docs = format_docs(docs)

        if docs is not None:
            # Create a dictionary with query and articles
            result = {
                "query": query,
                "articles": docs
            }
            print(f"Successfully retrieved articles for: {query}")
            end = time.time()
            print(f"Time taken for arxiv search: {end - start} seconds")
            return json.dumps(result, ensure_ascii=False, indent=2)
        else:
            print(f"No results found for query: {query}")
            return None

    except Exception as e:
        print(f"An error occurred while processing the Arxiv query: {e}")
        return None

    