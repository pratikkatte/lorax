

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
        lm = ChatOpenAI(
            model="gpt-4o", temperature=0)
        
        structured_code_llm = lm.with_structured_output(code, include_raw=True)

        # Chain with output check
        code_chain_raw = (
            code_gen_prompt | structured_code_llm
        )

        # This will be run as a fallback chain
        fallback_chain = insert_errors | code_chain_raw
        N = 3  # Max re-tries
        code_gen_chain_re_try = code_chain_raw.with_fallbacks(
            fallbacks=[fallback_chain] * N, exception_key="error"
        )
        code_gen_chain = code_gen_chain_re_try | parse_output
        try:

            # Retriever model
            docs = retriever.invoke(question)

            # docs = retriever.get_relevant_documents(question)
            context = "\n".join([doc.page_content for doc in docs])

            # infer
        except Exception as e:
            print("context Error:", e)

        code_solution = code_gen_chain.invoke(
            {"context": context, "messages": [question]}
        )

        if input_file_path:
            result = execute_generated_code(code_solution, input_file_path)
        else:
            result = "Couldn't execute the generated code. File Not Provided!"

        return code_solution, result
    except Exception as e:
        print("Tools Error:", e)
        return f"Found Error while processing your query", None

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

def generalInfoTool(question, attributes=None):
    """
    """
    prompt_template = """
    You are an  expert in treesequences and population genetics and you help in answering queries related to it in general.
    if the questions are not related to your experties then kindly remind them to ask questions in your domain of experties. 
    Respond the users in brief based on this query or message: {question}
    """
    try:
        prompt = PromptTemplate(
        input_variables=['question'], template=prompt_template
        )
        lm = ChatOpenAI(
        model="gpt-4o", temperature=0)
        chain = prompt | lm
        query = {"question":question}
        answer = chain.invoke(query)        
        return answer.content

    except Exception as e:
        return f"Found Error, {e}"
        

    