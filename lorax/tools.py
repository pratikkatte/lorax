

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
from pkg_resources import resource_filename



from lorax.utils import code, check_claude_output, insert_errors, parse_output, execute_generated_code
from lorax.faiss_vector import getRetriever

load_dotenv()

general_llm = ChatOpenAI(model_name='gpt-4o')

retriever = getRetriever()

def visualizationTool(question):
    question = "the genereated code should only return newick string. Here is the question: " + question 
    _ , newick_string = generatorTool(question)

    return newick_string

def generatorTool(question):
    # understnad, how this format of prompt engineering helps the LLM to get good results. 
    input_file_path =  resource_filename(__name__, './data/sample.trees')

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

    structured_code_llm = general_llm.with_structured_output(code, include_raw=True)

    # Chain with output check
    code_chain_raw = (
        code_gen_prompt | structured_code_llm | check_claude_output
    )

    # This will be run as a fallback chain
    fallback_chain = insert_errors | code_chain_raw
    N = 3  # Max re-tries
    code_gen_chain_re_try = code_chain_raw.with_fallbacks(
        fallbacks=[fallback_chain] * N, exception_key="error"
    )
    code_gen_chain = code_gen_chain_re_try | parse_output

    # Retriever model
    docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])

    # infer

    code_solution = code_gen_chain.invoke(
        {"context": context, "messages": [question]}
    )
    print("code solution", code_solution)
    
    result = execute_generated_code(code_solution, input_file_path)


    return code_solution, result

def routerTool(query):
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

    answer = chain.invoke(query)
    return answer

def generalInfoTool(question):
    """
    """
    prompt_template = """
    You are an  expert in treesequences and population genetics and you help in answering queries related to it in general.
    if the questions are not related to your experties then kindly remind them to ask questions in your domain of experties. 
    Respond the users in brief based on this query or message: {question}
    """
    prompt = PromptTemplate(
    input_variables=['question'], template=prompt_template
    )
    chain = prompt | general_llm
    query = {"question":question}
    answer = chain.invoke(query)
    
    return answer.content