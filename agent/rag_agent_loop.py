###################
# Setup and imports
###################
# Import necessary libraries
from dotenv import load_dotenv

from langchain_classic.tools.retriever import create_retriever_tool
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage

from langgraph.graph import MessagesState
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from pydantic import BaseModel, Field
from typing import Literal

# Import our custom vector store
from vector_store import DocumentVectorStore

# Import API navigator for code generation
from api_navigator import APINavigator

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
    messages = state["messages"]

    # Get the most recent human question (not necessarily the first message)
    human_messages = [m for m in messages if m.type == "human"]
    question = human_messages[-1].content if human_messages else messages[0].content

    # Context is still the last message (from retrieval tool)
    context = messages[-1].content

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
    """Rewrite the most recent user question while preserving conversation history."""
    messages = state["messages"]

    # Get the most recent human question
    human_messages = [m for m in messages if m.type == "human"]
    question = human_messages[-1].content if human_messages else messages[0].content

    prompt = REWRITE_PROMPT.format(question=question)
    response = response_model.invoke([{"role": "user", "content": prompt}])

    # Append the rewritten question to preserve history, don't replace all messages
    return {"messages": messages + [HumanMessage(content=response.content)]}


###################
# Generate Answer Node Stuff
###################
# Prompt for generating answers
GENERATE_PROMPT = (
    "You are an assistant for question-answering tasks. "
    "Use the full conversation history below to answer the current question. "
    "If you don't know the answer, just say that you don't know. "
    "Use three sentences maximum and keep the answer concise.\n\n"
    "Full Conversation:\n{conversation}"
)

# Function to generate answers
def generate_answer(state: MessagesState):
    """Generate an answer using full conversation context."""
    messages = state["messages"]

    # Build conversation from ALL messages
    conversation = "\n".join([
        f"{msg.type}: {msg.content}"
        for msg in messages
    ])

    prompt = GENERATE_PROMPT.format(conversation=conversation)

    response = response_model.invoke([{"role": "user", "content": prompt}])
    return {"messages": [response]}



######################
# Code Generation Tool
######################

# Prompt for API navigation
API_NAVIGATOR_PROMPT = (
    "You are helping to generate Python code using the tskit library.\n\n"
    "User request: {question}\n\n"
    "Here is the table of contents for the tskit Python API documentation:\n\n"
    "{toc}\n\n"
    "Based on the user's request, select the section IDs that would be most helpful "
    "for generating the code. Return ONLY a comma-separated list of section IDs, "
    "for example: treesequence-api,tskit.TreeSequence.diversity,loading-and-saving\n\n"
    "Section IDs to retrieve:"
)

# Prompt for code generation
CODE_GENERATION_PROMPT = (
    "You are generating Python code using the tskit library.\n\n"
    "User request: {question}\n\n"
    "Relevant API Documentation:\n"
    "{api_docs}\n\n"
    "Generate clean, working Python code (20-50 lines) that:\n"
    "- Uses exact method signatures from the API documentation above\n"
    "- Includes appropriate imports (import tskit, etc.)\n"
    "- Has basic error handling where appropriate\n"
    "- Is well-commented to explain what each section does\n"
    "- Follows Python best practices\n\n"
    "Output ONLY the Python code in a code block, with no additional explanation."
)

def api_navigator(state: MessagesState):
    """Navigate API documentation and retrieve relevant sections."""
    messages = state["messages"]

    # Get the most recent human question
    human_messages = [m for m in messages if m.type == "human"]
    question = human_messages[-1].content if human_messages else messages[0].content

    # Initialize API navigator with full path
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    api_doc_path = os.path.join(script_dir, "python-api.md")
    navigator = APINavigator(api_doc_path)

    # Get table of contents
    toc = navigator.get_toc(max_level=4)

    # Ask LLM to select relevant sections
    prompt = API_NAVIGATOR_PROMPT.format(question=question, toc=toc)
    response = response_model.invoke([{"role": "user", "content": prompt}])

    # Parse section IDs from response
    section_ids_str = response.content.strip()
    # Clean up the response - remove any markdown formatting
    section_ids_str = section_ids_str.replace("```", "").strip()
    section_ids = [sid.strip() for sid in section_ids_str.split(",")]

    # Retrieve sections
    api_docs = navigator.get_sections(section_ids)

    # Add API docs to message history
    from langchain_core.messages import AIMessage
    api_message = AIMessage(content=f"Retrieved API documentation:\n\n{api_docs}")

    return {"messages": messages + [api_message]}

def generate_code(state: MessagesState):
    """Generate Python code using retrieved API documentation."""
    messages = state["messages"]

    # Get the original user question
    human_messages = [m for m in messages if m.type == "human"]
    question = human_messages[-1].content if human_messages else ""

    # Get the API documentation (last AI message should contain it)
    api_docs = ""
    for msg in reversed(messages):
        if msg.type == "ai" and "Retrieved API documentation" in msg.content:
            api_docs = msg.content.replace("Retrieved API documentation:\n\n", "")
            break

    # Generate code
    prompt = CODE_GENERATION_PROMPT.format(question=question, api_docs=api_docs)
    response = response_model.invoke([{"role": "user", "content": prompt}])

    return {"messages": [response]}




###################
# Interactive Loop
###################
def run_interactive(graph):
    """Run the agent in interactive mode"""
    try:
        import pyfiglet
        banner = pyfiglet.figlet_format("tskit RAG", font="slant")
        print(banner)
    except ImportError:
        print("\n" + "="*70)
        print("tskit RAG Agent")
        print("="*70)

    print("="*70)
    print("Welcome to the tskit Documentation Retrieval & Code Generation Agent!")
    print("Ask questions about tskit or request code generation.")
    print("="*70)
    print("\nCapabilities:")
    print("  - Answer questions about tskit documentation")
    print("  - Generate Python code using the tskit API")
    print("\nCommands:")
    print("  - Type your question or code request naturally")
    print("  - Type 'quit' or 'exit' to end the session")
    print("  - Type 'clear' to start a new conversation")
    print("="*70 + "\n")

    # Maintain conversation state across queries
    conversation_state = {"messages": []}

    while True:
        try:
            # Get user input
            user_input = input("\nYou: ").strip()

            # Handle commands
            if user_input.lower() in ['quit', 'exit']:
                print("\nGoodbye!")
                break

            if user_input.lower() == 'clear':
                conversation_state = {"messages": []}
                print("\n[Conversation cleared. Starting fresh!]\n")
                continue

            if not user_input:
                continue

            # Add user message to conversation
            user_msg = HumanMessage(content=user_input)
            conversation_state["messages"].append(user_msg)

            # Invoke agent
            print("\n[Agent thinking...]")

            # Stream through the graph and collect final result
            final_state = None
            used_retriever = False
            used_code_gen = False
            for chunk in graph.stream(conversation_state):
                # Check which node is being executed and display status
                for node, update in chunk.items():
                    if node == "retrieve":
                        used_retriever = True
                        print("[Searching documentation...]")
                    elif node == "api_navigator":
                        used_code_gen = True
                        print("[Browsing API documentation...]")
                    elif node == "generate_code":
                        print("[Generating code...]")
                    final_state = update

            # Update conversation state with all messages from the final state
            if final_state:
                conversation_state["messages"].append(final_state["messages"][-1])

                # Print only the final AI response
                print("\nAgent:", end=" ")
                final_message = conversation_state["messages"][-1]
                if hasattr(final_message, 'content'):
                    print(final_message.content)
                else:
                    print(str(final_message))

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"\n[Error: {str(e)}]")
            print("Please try again or type 'clear' to reset.")


###################
# Main Code
###################
def main():
    # Initialize vector store using DocumentVectorStore class
    print("Initializing vector store...")

    # Get full paths for data files
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data-new.txt")
    store_path = os.path.join(script_dir, "tskit_vectorstore_class")

    vector_store = DocumentVectorStore(
        store_path=store_path,
        embedding_model="text-embedding-3-small",
        chunk_size=1000,
        chunk_overlap=200
    )

    # Load existing or create new vector store
    vector_store.load_or_create(document_path=data_path)
    print("✓ Vector store ready")

    # Create retriever
    retriever = vector_store.get_retriever(k=4)


    # Create retrieval tool
    retriever_tool = create_retriever_tool(
        name="tskit_documentation_retriever",
        description="Useful for answering questions about the tskit library and its documentation.",
        retriever=retriever,
    )

    # Create code generator tool (simple tool to signal code generation intent)
    from langchain_core.tools import tool

    @tool
    def code_generator_tool(query: str) -> str:
        """Use this tool when the user explicitly requests Python code generation using tskit.
        This will retrieve relevant API documentation and generate working code.

        Args:
            query: The user's code generation request
        """
        return f"Initiating code generation for: {query}"

    ################
    # Generate Agent
    ################
    chat_model = init_chat_model(model="gpt-4o", temperature=0)

    def generate_query_or_respond(state: MessagesState):
        """Call the model to generate a response based on the current state. Given
        the question, it will decide to retrieve using the retriever tool, generate code,
        or simply respond to the user.
        """
        response = (
            chat_model
            .bind_tools([retriever_tool, code_generator_tool]).invoke(state["messages"])
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

    # Combined router function to decide tool path or end
    def route_after_generate(state: MessagesState):
        """Route to retrieve, api_navigator, or END based on tool calls."""
        messages = state["messages"]
        last_message = messages[-1]

        # Check if there are tool calls
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            tool_name = last_message.tool_calls[0]["name"]
            if tool_name == "code_generator_tool":
                return "api_navigator"
            else:
                return "retrieve"

        # No tool calls means end
        return END

    # Define the nodes we will cycle between
    workflow.add_node(generate_query_or_respond)
    workflow.add_node("retrieve", ToolNode([retriever_tool]))
    workflow.add_node("api_navigator", api_navigator)
    workflow.add_node("generate_code", generate_code)
    workflow.add_node(rewrite_question)
    workflow.add_node(generate_answer)

    workflow.add_edge(START, "generate_query_or_respond")

    # Decide whether to retrieve for Q&A, navigate API for code, or end
    workflow.add_conditional_edges(
        "generate_query_or_respond",
        route_after_generate,
        {
            "retrieve": "retrieve",
            "api_navigator": "api_navigator",
            END: END,
        },
    )

    # Grade retrieved documents and decide next step (Q&A path)
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

    # Code generation path edges
    workflow.add_edge("api_navigator", "generate_code")
    workflow.add_edge("generate_code", END)

    # Q&A path edges
    workflow.add_edge("generate_answer", END)
    workflow.add_edge("rewrite_question", "generate_query_or_respond")

    # Compile the workflow
    graph = workflow.compile()


    # Visualize the workflow (commented out for interactive mode)
    # from IPython.display import Image, display
    # display(Image(graph.get_graph().draw_mermaid_png()))
    # png_bytes = graph.get_graph().draw_mermaid_png()
    # with open("rag_graph.png", "wb") as f:
    #     f.write(png_bytes)
    # print("Graph visualization saved to rag_graph.png")

    # Run interactive loop
    run_interactive(graph)





if __name__ == "__main__":
    main()

