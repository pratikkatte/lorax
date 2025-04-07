# OLLAMA VERSION
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from langchain_core.prompts import PromptTemplate
from langchain.chains import ConversationChain
from dotenv import load_dotenv
from pkg_resources import resource_filename
from lorax.config import LLM_TYPE, MODEL_NAME
from lorax.utils import code, check_claude_output, insert_errors, parse_output, execute_generated_code
from lorax.faiss_vector import getRetriever
from langchain_ollama.llms import OllamaLLM
from langchain_ollama import ChatOllama
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from ollama import chat


# from ollama_functions import OllamaFunctions
from langchain_experimental.llms.ollama_functions import OllamaFunctions


load_dotenv()

if LLM_TYPE == "OPENAI":
    print("Using OpenAI LLM")
    general_llm = ChatOpenAI(model_name=MODEL_NAME)
else:
    print("Using Ollama LLM")
    general_llm = ChatOllama(model="llama3.2", temperature=0)


retriever = getRetriever()

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

    # Retriever model
    docs = retriever.invoke(question)

    # docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])

    # Set up template
    template = """You are a Python coding generator with expertise in using tskit toolkit for analysing tree-sequences. \n 
        Here is a relevant set of tskit documentation:  \n ------- \n  {context} \n ------- \n Use the tskit module to answer the user 
        question based on the above provided documentation. Ensure any code you provide should be a callable function and can be executed \n 
        with all required imports and variables defined. Structure your answer with a description of the code solution. \n
        Do not give example usage, simply create a function that is callable with a tree file as an input. \n
        Then list the imports. And finally list the functioning code block. The function should return a string providing the answer. Maintain this order which is: \n
        1. Prefix (code description and helpful information about the tree sequence)\n
        2. Imports (required code imports like tskit, to run the code in Python, write them as import statements)\n
        3. Code (code block which is a callable function with a tree sequence file as an input parameter, does not include import statements)\n
        Here is the user question: {question}"""

    code_gen_prompt = ChatPromptTemplate.from_template(template)
    filled_prompt = code_gen_prompt.format(context=context, question=question)


    # Chain with output check
    # code_chain = (
    #     code_gen_prompt
    #     | general_llm
    # )

    response = chat(
        messages=[
                {
                'role': 'user',
                'content': filled_prompt,
                }
            ],
            model='llama3.1',
            format=code.model_json_schema(),
            options={'temperature': 0}
    )

    code_solution = code.model_validate_json(response.message.content)

    print("code_solution", code_solution)
    print("code solution type", type(code_solution))
    print("code solution prefix", code_solution.prefix if hasattr(code_solution, 'prefix') else None)
    print("code solution imports", code_solution.imports if hasattr(code_solution, 'imports') else None)
    print("code solution code", code_solution.code if hasattr(code_solution, 'code') else None)

    # # code_solution = code_chain.invoke(question)

    # # print("code_solution", code_solution)

    if input_file_path:
        result = execute_generated_code(code_solution, input_file_path)
    else:
        result = "Couldn't execute the generated code. File Not Provided!"

    return code_solution, result
    # except Exception as e:
    #     print("Tools Error:", e)
    #     return f"Found Error while processing your query", None

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
    """
    prompt_template = """
    You are an expert in treesequences and population genetics and you help in answering queries related to it in general.
    if the questions are not related to your expertise then kindly remind them to ask questions in your domain of experties. 
    Respond the users in brief based on this query or message: {question} \n\n
    Please respond in a clear and concise manner as a plain string only.
    """
    try:
        prompt = PromptTemplate(
            input_variables=['question'], template=prompt_template
        )
        # lm = ChatOpenAI(model="gpt-4o", temperature=0)
        chain = prompt | general_llm
        
        general_info_conversation = ConversationChain(
            llm=chain, 
            memory=attributes["memory"]
        )
     
        answer = general_info_conversation.run(question)   
        print("answer", answer)
        return answer

    except Exception as e:
        return f"Found Error, {e}"
        

