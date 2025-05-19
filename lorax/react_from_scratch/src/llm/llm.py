from typing import Optional
from typing import Dict
from typing import List 


def generate(model, contents) -> Optional[str]:
    """
    Generates a response using the provided model and contents.
    
    Args:
        model (GenerativeModel): The generative model instance.
        contents (List[Part]): The list of content parts.
    
    Returns:
        Optional[str]: The generated response text, or None if an error occurs.
    """
    try:
        # logger.info("Generating response from LLM")
        # response = model.generate_content(
        #     contents,
        #     generation_config=_create_generation_config(),
        #     safety_settings=_create_safety_settings()
        # )

        response = model.invoke(str(contents))

        if not response.text:
            # logger.error("Empty response from the model")
            return None

        # logger.info("Successfully generated response")
        return response
    except Exception as e:
        # logger.error(f"Error generating response: {e}")
        return None