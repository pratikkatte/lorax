from lorax import __main__
from lorax.langgraph_tskit import chat_interface

if __name__ == '__main__':
    INTERFACE = True
    if INTERFACE:
        __main__.main()
        # main()
    else:
        chat_interface()
        