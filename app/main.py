from fastapi import FastAPI, APIRouter, Depends, HTTPException
from pydantic import BaseModel


app = FastAPI()

@app.get('/')
def root():
    return {'message': 'API is running'}

