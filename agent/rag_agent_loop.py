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
    print("Welcome to the tskit Documentation Retrieval Agent!")
    print("Ask questions about tskit and get answers from the documentation.")
    print("="*70)
    print("\nCommands:")
    print("  - Type your question naturally")
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
            for chunk in graph.stream(conversation_state):
                # Check if retriever tool was called
                for node, update in chunk.items():
                    if node == "retrieve":
                        used_retriever = True
                        print("[Searching documentation...]")
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
    vector_store = DocumentVectorStore(
        store_path="tskit_vectorstore_class",
        embedding_model="text-embedding-3-small",
        chunk_size=1000,
        chunk_overlap=200
    )

    # Load existing or create new vector store
    vector_store.load_or_create(document_path="data-new.txt")
    print("✓ Vector store ready")

    # Create retriever
    retriever = vector_store.get_retriever(k=4)


    # Create retrieval tool
    retriever_tool = create_retriever_tool(
        name="tskit_documentation_retriever",
        description="Useful for answering questions about the tskit library and its documentation.",
        retriever=retriever,
    )

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

