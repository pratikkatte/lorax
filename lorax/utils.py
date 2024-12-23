from pydantic import BaseModel, Field
import ast
from types import ModuleType
import sys
import inspect


# Optional: Check for errors in case tool use is flaky
def check_claude_output(tool_output):
    """Check for parse error or failure to call the tool"""
    # Error with parsing
    if tool_output["parsing_error"]:
        # Report back output and parsing errors
        print("Parsing error!")
        raw_output = str(tool_output["raw"].content)
        error = tool_output["parsing_error"]
        raise ValueError(
            f"Error parsing your output! Be sure to invoke the tool. Output: {raw_output}. \n Parse error: {error}"
        )

    # Tool was not invoked
    elif not tool_output["parsed"]:
        print("Failed to invoke tool!")
        raise ValueError(
            "You did not use the provided tool! Be sure to invoke the tool to structure the output."
        )
    return tool_output

def insert_errors(inputs):
    """Insert errors for tool parsing in the messages"""

    # Get errors
    error = inputs["error"]
    messages = inputs["messages"]
    messages += [
        (
            "assistant",
            f"Retry. You are required to fix the parsing errors: {error} \n\n You must invoke the provided tool.",
        )
    ]
    return {
        "messages": messages,
        "context": inputs["context"],
    }

def parse_output(solution):
    """When we add 'include_raw=True' to structured output,
    it will return a dict w 'raw', 'parsed', 'parsing_error'."""
    return solution["parsed"]

class code(BaseModel):
    """
    Schema for code solutions for questions about tskit. 
    """
    prefix: str = Field(description="Description of the problem and approach")
    imports: str = Field(description="Code block import statements")
    code: str = Field(description="Code block should contain function that can be called. It should have input file_path to tree_sequence. It should not include import statements")


def execute_generated_code(structured_output, *args, **kwargs):
    # Combine imports and code
    full_code = structured_output.imports + "\n\n" + structured_output.code
    
    # Create a new module to execute the code
    mod = ModuleType("dynamic_module")
    sys.modules["dynamic_module"] = mod
    
    # Execute the code within the module's namespace
    exec(full_code, mod.__dict__)
    
    # Find the last function defined in the code
    tree = ast.parse(full_code)
    functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
    if not functions:
        raise ValueError("No function found in the generated code")
    
    last_function = functions[-1]
    function_name = last_function.name
    
    # Get the function from the module
    func = getattr(mod, function_name)
    
    # Inspect the function to get its parameters
    sig = inspect.signature(func)
    params = sig.parameters
    
    # Prepare the arguments for the function call
    call_args = []
    call_kwargs = {}
    
    for i, (param_name, param) in enumerate(params.items()):
        if i < len(args):
            call_args.append(args[i])
        elif param_name in kwargs:
            call_kwargs[param_name] = kwargs[param_name]
        elif param.default is not param.empty:
            call_kwargs[param_name] = param.default
        else:
            raise ValueError(f"Missing required argument: {param_name}")
    
    # Call the function and return its result
    return func(*call_args, **call_kwargs)