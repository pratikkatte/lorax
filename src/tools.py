
from utils import code, check_claude_output, insert_errors, parse_output

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

def generator_tool():
    # understnad, how this format of prompt engineering helps the LLM to get good results. 

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

    expt_llm = "gpt-4o-mini"

    code_llm = ChatOpenAI(temperature=0, model=expt_llm)

    structured_code_llm = code_llm.with_structured_output(code, include_raw=True)

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

    return code_gen_chain


