from lorax.interface import main
from lorax.chat.langgraph_tskit import chat_interface

if __name__ == '__main__':
    INTERFACE = True
    if INTERFACE:
        # interface()
        main()
    else:
        chat_interface()