from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from presidio_analyzer.nlp_engine import NlpEngineProvider
from app.core.config import settings

configuration = {
    'nlp_engine_name': settings.nlp.nlp_engine_name,
    'models': settings.nlp.models
}

provider = NlpEngineProvider(nlp_configuration=configuration)
nlp_engine = provider.create_engine()
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

OPERATORS = {
    # Highly sensitive → full redaction
    "CREDIT_CARD": OperatorConfig("redact"),
    "PASSWORD": OperatorConfig("redact"),

    # Personally identifiable → masking
    "PHONE_NUMBER": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 6}),
    "EMAIL_ADDRESS": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 6}),
    
    # Structured IDs → partial masking
    "AADHAR_NUMBER": OperatorConfig("mask", {"masking_char": "X", "chars_to_mask": 8}),
    "PAN": OperatorConfig("mask", {"masking_char": "X", "chars_to_mask": 5}),

    # Names → replace (preserve semantics)
    "PERSON": OperatorConfig("replace", {"new_value": "<PERSON>"}),

    # Locations → generalize
    "LOCATION": OperatorConfig("replace", {"new_value": "<LOCATION>"}),

    # Dates → partial masking
    "DATE_TIME": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 4}),

    # IP → hash (useful for tracking without exposing)
    "IP_ADDRESS": OperatorConfig("hash"),
}

def masked_user_input(text:str, entities_to_mask: list[str] | None=None):

    results = analyzer.analyze(
        text=text,
        language="en"
    )

    if entities_to_mask:
        results = [r for r in results if r.entity_type in entities_to_mask]
        
    anonymized = anonymizer.anonymize(
        text=text,
        analyzer_results=results,
        operators=OPERATORS
    )

    return {
        "original": text,
        "anonymized": anonymized.text,
        "entities_detected": [r.entity_type for r in results]
    }