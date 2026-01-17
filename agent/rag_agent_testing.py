###################
# Setup and imports
###################
# Import necessary libraries
import os
import sys
from dotenv import load_dotenv

from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_classic.tools.retriever import create_retriever_tool
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_core.messages import convert_to_messages
from langchain_core.messages import HumanMessage

from langgraph.graph import MessagesState
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

import faiss

from pydantic import BaseModel, Field
from typing import Literal

from IPython.display import Image, display

# Load environment variables
load_dotenv()



###################
# Node Stuff
###################
# Node response model
response_model = init_chat_model("openai:gpt-4o", temperature=0)


###################
# Grade Prompt Node Stuff
###################
GRADE_PROMPT = (
    "You are a grader assessing relevance of a retrieved document to a user question. \n "
    "Here is the retrieved document: \n\n {context} \n\n"
    "Here is the user question: {question} \n"
    "If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant. \n"
    "Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question."
)

# Define structured output model for grading
class GradeDocuments(BaseModel):  
    """Grade documents using a binary score for relevance check."""

    binary_score: str = Field(
        description="Relevance score: 'yes' if relevant, or 'no' if not relevant"
    )

# Function to grade documents
def grade_documents(
    state: MessagesState,
) -> Literal["generate_answer", "rewrite_question"]:
    """Determine whether the retrieved documents are relevant to the question."""
    question = state["messages"][0].content
    context = state["messages"][-1].content

    prompt = GRADE_PROMPT.format(question=question, context=context)
    response = (
        response_model
        .with_structured_output(GradeDocuments).invoke(  
            [{"role": "user", "content": prompt}]
        )
    )
    score = response.binary_score

    if score == "yes":
        return "generate_answer"
    else:
        return "rewrite_question"
    

###################
# Rewrite Questions Node Stuff
###################
# Initialize response model for rewriting questions
REWRITE_PROMPT = (
    "Look at the input and try to reason about the underlying semantic intent / meaning.\n"
    "Here is the initial question:"
    "\n ------- \n"
    "{question}"
    "\n ------- \n"
    "Formulate an improved question:"
)

# Function to rewrite questions
def rewrite_question(state: MessagesState):
    """Rewrite the original user question."""
    messages = state["messages"]
    question = messages[0].content
    prompt = REWRITE_PROMPT.format(question=question)
    response = response_model.invoke([{"role": "user", "content": prompt}])
    return {"messages": [HumanMessage(content=response.content)]}


###################
# Generate Answer Node Stuff
###################
# Prompt for generating answers
GENERATE_PROMPT = (
    "You are an assistant for question-answering tasks. "
    "Use the following pieces of retrieved context to answer the question. "
    "If you don't know the answer, just say that you don't know. "
    "Use three sentences maximum and keep the answer concise.\n"
    "Question: {question} \n"
    "Context: {context}"
)

# Function to generate answers
def generate_answer(state: MessagesState):
    """Generate an answer."""
    question = state["messages"][0].content
    context = state["messages"][-1].content
    prompt = GENERATE_PROMPT.format(question=question, context=context)
    response = response_model.invoke([{"role": "user", "content": prompt}])
    return {"messages": [response]}




###################
# Main Code
###################
def main():
    # Initialize embeddings model
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    # Load or create vector store
    vector_store_path = "tskit_vectorstore_class"
    if os.path.exists(vector_store_path):
        print(f"Loading existing vector store from '{vector_store_path}'...")
        vectorstore = FAISS.load_local(
            vector_store_path,
            embeddings,
            allow_dangerous_deserialization=True
        )
    else:
        print(f"Creating new vector store...")
        loader = TextLoader("data-new.txt")
        documents = loader.load()

        # Split documents
        python_splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.PYTHON,
            chunk_size=1000,
            chunk_overlap=200
        )
        tskit_docs = python_splitter.split_documents(documents)

        # Create FAISS index
        embedding_dim = len(embeddings.embed_query("hello world"))
        index = faiss.IndexFlatL2(embedding_dim)

        # Initialize empty vector store
        vectorstore = FAISS(
            embedding_function=embeddings,
            index=index,
            docstore=InMemoryDocstore(),
            index_to_docstore_id={},
        )

        # Add documents in batches
        batch_size = 500
        for i in range(0, len(tskit_docs), batch_size):
            batch = tskit_docs[i:i + batch_size]
            vectorstore.add_documents(batch)

        # Save vector store
        vectorstore.save_local(vector_store_path)

    # Create retriever
    retriever = vectorstore.as_retriever()
    print("Retriever ready.")


    # Create retrieval tool
    retriever_tool = create_retriever_tool(
        name="tskit_documentation_retriever",
        description="Useful for answering questions about the tskit library and its documentation.",
        retriever=retriever,
    )

    # Test
    # print(retriever_tool.invoke({"query": "what is a tree sequence?"})[:200])


    ###############
    # Node Testing
    ###############
    # Test grade documents function
    # input = {
    #     "messages": convert_to_messages(
    #         [
    #             {
    #                 "role": "user",
    #                 "content": "What does Lilian Weng say about types of reward hacking?",
    #             },
    #             {
    #                 "role": "assistant",
    #                 "content": "",
    #                 "tool_calls": [
    #                     {
    #                         "id": "1",
    #                         "name": "retrieve_blog_posts",
    #                         "args": {"query": "types of reward hacking"},
    #                     }
    #                 ],
    #             },
    #             {"role": "tool", "content": "Lilian Wang says all types of reward hacking are cool.", "tool_call_id": "1"},
    #         ]
    #     )
    # }
    # print(grade_documents(input))

    # # Test rewrite question function
    # input = {
    #     "messages": convert_to_messages(
    #         [
    #             {
    #                 "role": "user",
    #                 "content": "What does Lilian Weng say about types of reward hacking?",
    #             },
    #             {
    #                 "role": "assistant",
    #                 "content": "",
    #                 "tool_calls": [
    #                     {
    #                         "id": "1",
    #                         "name": "retrieve_blog_posts",
    #                         "args": {"query": "types of reward hacking"},
    #                     }
    #                 ],
    #             },
    #             {"role": "tool", "content": "meow", "tool_call_id": "1"},
    #         ]
    #     )
    # }

    # response = rewrite_question(input)
    # print(response["messages"][-1]["content"])


    # # Test generate answer function
    # input = {
    #     "messages": convert_to_messages(
    #         [
    #             {
    #                 "role": "user",
    #                 "content": "What does Lilian Weng say about types of reward hacking?",
    #             },
    #             {
    #                 "role": "assistant",
    #                 "content": "",
    #                 "tool_calls": [
    #                     {
    #                         "id": "1",
    #                         "name": "retrieve_blog_posts",
    #                         "args": {"query": "types of reward hacking"},
    #                     }
    #                 ],
    #             },
    #             {
    #                 "role": "tool",
    #                 "content": "reward hacking can be categorized into two types: environment or goal misspecification, and reward tampering",
    #                 "tool_call_id": "1",
    #             },
    #         ]
    #     )
    # }
    # # Generate answer context
    # response = generate_answer(input)
    # print("="*30, "Generated Answer", "="*30)
    # response["messages"][-1].pretty_print()
    # print("="*70)



    ################
    # Generate Agent
    ################
    chat_model = init_chat_model(model="gpt-4o", temperature=0)

    def generate_query_or_respond(state: MessagesState):
        """Call the model to generate a response based on the current state. Given
        the question, it will decide to retrieve using the retriever tool, or simply respond to the user.
        """
        response = (
            chat_model
            .bind_tools([retriever_tool]).invoke(state["messages"])  
        )
        return {"messages": [response]}
    
    ####################
    # Test the agent
    ###################
    # input = {"messages": [{"role": "user", "content": "hello!"}]}
    # generate_query_or_respond(input)["messages"][-1].pretty_print()

    # # Test the agent again
    # input = {
    #     "messages": [
    #         {
    #             "role": "user",
    #             "content": "What are the main features of tskit?",
    #         }
    #     ]
    # }
    # generate_query_or_respond(input)["messages"][-1].pretty_print()

    ####################
    # Build a state graph for the agent
    ###################
    # Define the state graph
    workflow = StateGraph(MessagesState)

    # Define the nodes we will cycle between
    workflow.add_node(generate_query_or_respond)
    workflow.add_node("retrieve", ToolNode([retriever_tool]))
    workflow.add_node(rewrite_question)
    workflow.add_node(generate_answer)

    workflow.add_edge(START, "generate_query_or_respond")

    # Decide whether to retrieve
    workflow.add_conditional_edges(
        # Source Node
        "generate_query_or_respond",

        # Condition function (Assess LLM decision (call `retriever_tool` tool or respond to the user)
        tools_condition,

        # Route mapping
        {
            # Translate the condition outputs to nodes in our graph
            "tools": "retrieve",
            END: END,
        },
    )

    # Grade retrieved documents and decide next step
    workflow.add_conditional_edges(
        # Source Node
        "retrieve",

        # Condition function
        grade_documents,

        # Route mapping
        {
            "generate_answer": "generate_answer",
            "rewrite_question": "rewrite_question",
        }
    )

    # Non-conditional Edges (source_node, dest_node)
    workflow.add_edge("generate_answer", END)
    workflow.add_edge("rewrite_question", "generate_query_or_respond")

    # Compile the workflow
    graph = workflow.compile()


    # Visualize the workflow
    from IPython.display import Image, display

    #display(Image(graph.get_graph().draw_mermaid_png()))
    # png_bytes = graph.get_graph().draw_mermaid_png()
    # with open("rag_graph.png", "wb") as f:
    #     f.write(png_bytes)
    # print("Graph visualization saved to rag_graph.png")

    for chunk in graph.stream(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "What is a node in tskit?",
                }
            ]
        }
    ):
        for node, update in chunk.items():
            print("Update from node", node)
            update["messages"][-1].pretty_print()
            print("\n\n")





if __name__ == "__main__":
    main()

