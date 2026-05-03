from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict, Type, Optional, Annotated
from pydantic import BaseModel, Field, AnyHttpUrl

class LLMSettings(BaseSettings):
    """LLM and Provider Configurations."""
    gemini_api_key: str=Field(..., validation_alias='MAIN_GOOGLE_API_KEY')
    model_name: str = Field(..., validation_alias='MODEL_NAME')
    max_tokens: int=Field(512, validation_alias='MAX_TOKENS')
    temperature: float=Field(0.7, validation_alias='TEMPERATURE')

class RAGSettings(BaseSettings):
    """Configurations for the RAG and Memory layers."""
    mem0_api_key: Optional[str] = Field(None, validation_alias='MEM0_API_KEY')
    sys_prompt_path: str = Field(..., validation_alias='SYS_PROMPT_PATH')

class AppSettings(BaseSettings):
    """General FastAPI and Service settings."""
    app_name: str = Field(..., validation_alias='APP_NAME')
    app_version: str = Field(..., validation_alias='APP_VERSION')
    debug: bool = False
    
    # External Service URLs
    auth_service_url: Optional[AnyHttpUrl] = None

class DatabaseSettings(BaseSettings):
    db_url: str = Field(..., validation_alias='DATABASE_URL')
    db_name: str = Field(..., validation_alias='DATABASE_NAME')
    db_pass: str = Field(..., validation_alias='DATABASE_PASSWORD')

class NLPEngine(BaseSettings):
    nlp_engine_name: str = Field(..., validation_alias='NLP_ENGINE_NAME')
    models: List[Dict[str, str]] = [{"lang_code": "en", "model_name": "en_core_web_lg"}]

class Settings(BaseSettings):
    """Master Settings Object."""
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    app: AppSettings = AppSettings()
    llm: LLMSettings = LLMSettings()
    rag: RAGSettings = RAGSettings()
    db: DatabaseSettings = DatabaseSettings()
    nlp: NLPEngine = NLPEngine()



settings = Settings()