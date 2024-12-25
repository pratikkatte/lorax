from lorax import __main__
from lorax.langgraph_tskit import chat_interface


INTERFACE = True

if INTERFACE:
    __main__.main()
else:
    chat_interface()
    