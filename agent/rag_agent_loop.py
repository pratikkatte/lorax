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

# Import custom vector store class
from vector_store import DocumentVectorStore

# Load environment variables
load_dotenv()



###################
# Node Stuff
###################
# Node response model
response_model = init_chat_model("openai:gpt-5-mini", temperature=0)


###################
# Grade Prompt Node Stuff
###################
GRADE_PROMPT = (
    "You are a grader assessing relevance of a retrieved document to a user question about tskit. \n "
    "Here is the retrieved document: \n\n {context} \n\n"
    "Here is the user question: {question} \n"
    "If the document contains keyword(s) or semantic meaning related to the tskit question, grade it as relevant. \n"
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
    "You are helping reformulate questions about tskit (a Python library for tree sequences) to improve retrieval results.\n"
    "Look at the input and try to reason about the underlying semantic intent / meaning.\n"
    "Here is the initial question about tskit:"
    "\n ------- \n"
    "{question}"
    "\n ------- \n"
    "Formulate an improved question that is more specific and likely to retrieve relevant tskit documentation:"
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
    "You are a helpful chatbot assistant specializing in tskit, a Python library for analyzing tree sequences in population genetics. "
    "Your role is to answer questions about tskit's functionality, API, concepts, and usage based on the official documentation. "
    "Use the following pieces of retrieved context from the tskit documentation to answer the question. "
    "If the context doesn't contain enough information to answer the question, say that you don't know or that the information isn't in the provided documentation. "
    "Be clear, concise, and accurate. Use code examples from the context when relevant.\n\n"
    "Question: {question} \n\n"
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
            conversation_state["messages"].append(HumanMessage(content=user_input))

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
                conversation_state["messages"] = final_state["messages"]

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
    # Initialize DocumentVectorStore with enhanced metadata
    print("Initializing vector store...")
    doc_store = DocumentVectorStore(
        store_path="tskit_vectorstore_class",
        embedding_model="text-embedding-3-small",
        chunk_size=1000,
        chunk_overlap=200
    )

    # Load or create vector store (uses smart_loader_enhanced internally)
    doc_store.load_or_create(document_path="data-new.txt")

    # Create retriever
    retriever = doc_store.get_retriever(k=4)
    print("Retriever ready with enhanced metadata.")


    # Create retrieval tool
    retriever_tool = create_retriever_tool(
        name="tskit_documentation_retriever",
        description=(
            "Search the tskit documentation for information about the tskit Python library. "
            "Use this tool when users ask about tskit concepts (tree sequences, nodes, edges, mutations, sites), "
            "API functions, methods, classes, usage examples, or any technical questions about tskit. "
            "Input should be a search query related to tskit."
        ),
        retriever=retriever,
    )

    ################
    # Generate Agent
    ################
    chat_model = init_chat_model(model="gpt-5-mini", temperature=0)

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

