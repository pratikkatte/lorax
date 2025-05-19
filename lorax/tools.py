

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from langchain_core.prompts import PromptTemplate
from langchain.chains import ConversationChain
from dotenv import load_dotenv
from pkg_resources import resource_filename
import numpy as np
import ollama

from lorax.utils import code, execute_generated_code, response_parser, parse_output
from lorax.faiss_vector import getRetriever, rerank_documents

from langchain_tavily import TavilySearch

from langchain.agents import AgentExecutor, create_react_agent
from langchain_community.agent_toolkits.load_tools import load_tools
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from lorax.react_from_scratch.src.react.agent import run
import time


load_dotenv()

MODEL_NAME = ("OPENAI", "gpt-4o")

ollama_client = None

general_llm = ChatOpenAI(model_name='gpt-4o', temperature=0)

retriever, reranker = getRetriever()



def visualizationTool(question, attributes=None):
    question = """
    The generated code should return two outputs in the following specific order:
        1. Only a Newick string representation of the tree.
        2. A sentence describing the genome position of the tree.
        Here is the question: """ + question 

    _ , newick_string_genome_position = generatorTool(question, attributes['file_path'])

    if type(newick_string_genome_position) == tuple:
        nwk_string, genomic_position = newick_string_genome_position
    else:
        nwk_string, genomic_position = newick_string_genome_position.split("\n")

    return nwk_string, genomic_position

def generatorTool(question, input_file_path=None):
    try:

        # understnad, how this format of prompt engineering helps the LLM to get good results. 
        # input_file_path =  resource_filename(__name__, './data/sample.trees')

        code_gen_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are a coding generator with expertise in using ts-kit toolkit for analysing tree-sequences. \n 
                    Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Answer the user 
                    question based on the above provided documentation. Ensure any code you provide should be a callable function and can be executed \n 
                    with all required imports and variables defined. Structure your answer with a description of the code solution. \n
                    Then list the imports. And finally list the functioning code block. The function should return a string providing the answer. Here is the user question:""",
                    ), 
                    ("placeholder", "{messages}"),
                ]
            )
        

        try:
            # Retriever model
            docs = retriever.invoke(question)
            final_context = rerank_documents(question, reranker, docs, 3)
            # infer
        except Exception as e:
            print("context Error:", e)

        comp, model = MODEL_NAME
        if comp=="OPENAI":

            lm = ChatOpenAI(
                model=model, temperature=0)
        
            structured_code_llm = lm.with_structured_output(code, include_raw=True)

            # Chain with output check
            code_chain_raw = (
                code_gen_prompt | structured_code_llm | parse_output
            )
    
            code_solution = code_chain_raw.invoke(
                {"context": final_context, "messages": [question]}
            )
            
        else:
            client = ollama.Client(host=ollama_client)

            filled_prompt = code_gen_prompt.format(context=final_context, question=question)
            response = client.chat(
                messages=[{
                        'role': 'user',
                        'content': filled_prompt,
                        }],
                        model=model,
                    # format=code.model_json_schema(),
                        options={'temperature': 0})
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

    
    # prompt_template = """
    #     You are an expert in treesequences and population genetics and you help in answering queries related to it in general.
    #     If the questions are not related to your expertise then kindly remind them to ask questions in your domain of expertise. 
    #     Respond to the user based on this query or message: {question}
    # """

    # prompt_template = """Answer the following questions as best you can. 
    #     The general topic of this conversation is treesequences and population genetics but don't include this in your search, just keep that in mind.
    #     Include citations or reference links where applicable. 
    #     You have access to the following tools:

    #     {tools}

    #     Use the following format and stick to it:

    #     Question: the input question you must answer
    #     Thought: you should always think about what to do
    #     Action: the action to take, should be one of [{tool_names}] or "Finish"
    #     Action Input: the input to the action
    #     Observation: the result of the action
    #     ... (this Thought/Action/Action Input/Observation can repeat N times until you decide to "Finish")
    #     Thought: I now know the final answer
    #     Final Answer: the final detailed answer to the original input question (with reference links if applicable)

    #     Begin!

    #     Context: {context}
    #     Question: {input}
    #     Thought:{agent_scratchpad}"""

    try:
        start = time.time()
        answer = run(question, attributes["memory"])

        end = time.time()

        print("Time taken to answer the question:", end-start)
    #     prompt = PromptTemplate(
    #         input_variables=['input', 'context'], template=prompt_template
    #     )
    #     # lm = ChatOpenAI(model="gpt-4o", temperature=0)
    #     print("before lm")
    #     lm = ChatOllama(
    #         base_url="https://uwx72r685xxxb8-11434.proxy.runpod.net/",
    #         model="llama3.2",  # or "llama3:latest" depending on what you pulled
    #         temperature=0
    #     )
    #     print("after lm")
    #     # lm = ChatOllama(model="llama3.2", temperature=0, api_key="76c6d00e-b785-45b4-a552-e3cb52304e29")

    #     tools = [
    #         *load_tools(["arxiv"]),
    #         TavilySearch(
    #             max_results=5,
    #             topic="general",
    #             search_depth="advanced"
    #         )
    #     ]

    #     agent = create_react_agent(lm, tools, prompt)
    #     agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True)

    #     print("before answer")
    #     answer = agent_executor.invoke({"input": question, "context": attributes["memory"]})
    #     print("after answer")
    #     # print("Answer:", answer["output"])

        return answer
    except Exception as e:
        return f"Found Error, {e}"
        

    