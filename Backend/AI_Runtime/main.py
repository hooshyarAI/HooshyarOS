from fastapi import FastAPI
from Backend.AI_Runtime.api.executor import execute_goal


app = FastAPI(
    title="HooshyarOS AI Runtime"
)


@app.get("/")
def health():

    return {
        "runtime":"AI",
        "status":"online"
    }


@app.post("/execute")
def execute(goal:str):

    return execute_goal(goal)

