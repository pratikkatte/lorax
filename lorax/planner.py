from pydantic import BaseModel, Field
from typing import List
import enum

from lorax.tools import generalInfoTool, generatorTool, visualizationTool

def generate_response(*args, tool):
    """
    """
    if tool=='code':
        code_solution, result = args
     
        response = "\n".join([
            code_solution.prefix,
            code_solution.imports,
            code_solution.code,
            result
        ])
        return {'text': response, 'visual': None}
    
    if tool=='visual':
        nwk_string, result = args

        return {
            'text': result, 
            'visual': nwk_string
        }

    if tool == 'general':
        response = args
        print('result', response)
        return {
            'text': response,
            'visual': None
        }    
    return {
        'text': None,
        'visual':None
            }

class Tools(BaseModel):
    @staticmethod
    def visualization(query: str) -> str:
        nwk_string = visualizationTool(query)
        # with open('file.txt', 'w') as file:
        #     file.write(result)
        result = f'The tree is shown in the visualization board!'
        
        result = generate_response(nwk_string, result, tool='visual')
        
        return result
 
    @staticmethod
    def code_generation(query: str) -> str:
        code_solution, result = generatorTool(query)
        # return response
        result = generate_response(code_solution, result, tool='code')

        return result
    
    @staticmethod
    def general_answer(query:str) -> str:
        # response = TreeSequenceTool.generalInfoTool(query)
        response = generalInfoTool(query)

        return {
            'text': response,
            'visual': None
        }
    
    @staticmethod
    def fetch_file(query: str) -> str:
        return f"fetching file"
    
class ToolType(str, enum.Enum):
    """
    Enumeration representing the types of tools that can be used to a answer the question.
    """
    VISUALIZATION = "VISUALIZATION"
    CODE_GENERATE = "CODE_GENERATE"
    GENERAL_ANSWER = "GENERAL_ANSWER"
    FETCH_FILE = "FETCH_FILE"


class ComputeQuery(BaseModel):
    """
    Models a computation of a query, assume this can be some RAG system like llamaindex
    """
    query: str
    response: dict = {}
    tool : object
    done: bool = False


    def execute(self):
        """
        """
        if self.tool == ToolType.VISUALIZATION:
            self.response = Tools.visualization(self.query)
        elif self.tool == ToolType.CODE_GENERATE:
            self.response = Tools.code_generation(self.query)
        elif self.tool == ToolType.GENERAL_ANSWER:
            self.response = Tools.general_answer(self.query)
        else:
            self.response = Tools.fetch_file(self.query)

        if self.response:
            self.done = True
            
class MergedResponses(BaseModel):
    """
    Models a merged response of multiple queries.
    Currently we just concatinate them but we can do much more complex things.
    """
    dependent_queries: list[ComputeQuery]
    query: str = '...'
    tool: object

    def execute(self):
        """
        """
        prompt = ""
        "\n".join([f"Question: {query.query} \n Answer: {query.response}"  for query in self.dependent_queries])

        self.query = f"""
                    These are the list of questions and its' responses. {prompt} Based on this, answer this {self.query}
                                         """
        merger_query = ComputeQuery(query=self.query, tool=self.tool)
        merger_query.execute()

        return merger_query


class QueryType(str, enum.Enum):
    """
    Enumeration representing the types of queries that can be asked to a question answer system.
    """
    # When i call it anything beyond 'merge multiple responses' the accuracy drops significantly.
    SINGLE_QUESTION = "SINGLE"
    MULTI_DEPENDENCY = "MULTI_DEPENDENCY"

class Query(BaseModel):
    """
    Class representing a single question in a question answer subquery.
    Can be either a single question or a multi question merge.
    """

    id: int = Field(..., description="Unique id of the query")
    question: str = Field(
        ...,
        description="Question we are asking using a question answer system, if we are asking multiple questions, this question is asked by also providing the answers to the sub questions",
    )
    
    dependancies: list[int] = Field(
        default_factory=list,
        description="List of sub questions that need to be answered before we can ask the question. Use a subquery when anything may be unknown, and we need to ask multiple questions to get the answer. Dependences must only be other queries.",
    )
    query_type: QueryType = Field(
        default=QueryType.SINGLE_QUESTION,
        description="Type of question we are asking, either a single question or a multi question merge when there are multiple questions",
    )
    tool_type: ToolType = Field(
        description="decide tool that can be used to resolve."
    )

    def execute(self, dependency_func, completed, result, dependency_call):
        """
        """ 
        if self.id in completed:
            if dependency_call:
                return result[self.id]
            else:
                return
            
        
        if self.query_type == QueryType.SINGLE_QUESTION:
            # print("question", self.query_type, self.question, self.id)
            completed.add(self.id)

            # ComputeQuery(self.query)
            compute_query = ComputeQuery(query=self.question, tool=self.tool_type)
            compute_query.execute()

            result[self.id] = compute_query
            return result[self.id]
        else:
            sub_queries = dependency_func(self.dependancies)
            # computed_queries = await asyncio.gather(
            #     *[q.execute(dependency_func=dependency_func,completed=completed, result=result) for q in sub_queries]
            #     )

            computed_queries = [q.execute(dependency_func, completed=completed, result=result, dependency_call=True) for q in sub_queries]
            completed.add(self.id)

            merge_responses = MergedResponses(query=self.question, dependent_queries=computed_queries, tool=self.tool_type)
            
            result[self.id] = merge_responses.execute()
            return result[self.id]
        

class QueryPlan(BaseModel):
    """Container class representing a tree of questions to ask a question answering system.
        and its dependencies. Make sure every question is in the tree, and every question is asked only once.
    """

    query_graph: List[Query] = Field(
        ..., description="The query graph representing the plan for the the original question we are asking"
    )

    def dependencies(self, idz: list[int]) -> list[Query]:
        """
        Returns the dependencies of the query with the given id.
        """
        return [q for q in self.query_graph if q.id in idz]

    def execute(self):
        # this should be done with a topological sort, but this is easier to understand
        # start = 0
        completed = set()
        result = {}
        response = []
        for query in self.query_graph[::-1]:
            res = query.execute(
                dependency_func=self.dependencies,
                completed=completed,
                result=result,
                dependency_call=False
            )
            if res is not None:
                response.append(res)
        
        # response = await original_question.execute(dependency_func=self.dependencies, completed)
        return response
