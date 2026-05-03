from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate
from app.core.config import settings
from app.utils.mask_input import masked_user_input


def load_prompt(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


SYSTEM_PROMPT = load_prompt(settings.sys_prompt_path)

def build_prompt(text: str, entities_to_mask: list[str], chat_history: list[BaseMessage] | None = None):
    masked_text = masked_user_input(text, entities_to_mask)['anonymized']

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
        ]
    )

    return prompt.invoke({"chat_history": chat_history or [], "input": masked_text})