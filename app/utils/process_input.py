from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate
from app.core.config import settings

def load_prompt(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

SYSTEM_PROMPT = load_prompt(settings.sys_prompt_path)

prompt = ChatPromptTemplate.from_messages([
    ('system', SYSTEM_PROMPT),
    ('placeholder','{chat_history}'),
    ('human','{input}')
])