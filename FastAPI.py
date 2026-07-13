from typing import Annotated
from typing_extensions import TypedDict
import base64

from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage

from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import InMemorySaver

SYSTEM_PROMPT = """
You are an expert Persian chef and food assistant.

Your task is to identify every edible item from:
- Uploaded images
- User messages
- Previous conversation

Edible items include (but are not limited to):
- Vegetables
- Fruits
- Meat
- Chicken
- Fish
- Eggs
- Dairy
- Rice
- Bread
- Beans
- Lentils
- Nuts
- Herbs
- Spices
- Oils
- Sauces
- Drinks
- Desserts
- Any other food ingredient

Always respond using the provided schema.

Rules:

1. response
Your normal conversational response.

2. ingredients
Return every detected edible item.
Each ingredient must appear only once with its total count.

3. recipes
Suggest Persian recipes that can be made.

4. Prefer recipes that use the user's available ingredients.

5. If ingredients are missing, mention them.

6. For every recipe explain:
- why it was suggested
- what ingredients are already available
- what ingredients are missing

7. Ingredient names must always be in English.

8. Recipe names may be in Persian or English.

9. If no food items are detected, ingredients must be empty and politely ask the user to upload food images or describe their ingredients.
"""

class Ingredient(BaseModel):
    name: str = Field(description="Ingredient name in English")
    count: int = Field(description="Detected quantity")

class Recipe(BaseModel):
    name: str = Field(description="Recipe name")
    available_ingredients: list[str] = Field(default_factory=list)
    missing_ingredients: list[str] = Field(default_factory=list)
    explanation: str = Field(description="Why this recipe is suggested")

class ChatResponse(BaseModel):
    response: str

    ingredients: list[Ingredient] = Field(
        default_factory=list,
        description="Detected edible items."
    )

    recipes: list[Recipe] = Field(
        default_factory=list,
        description="Suggested Persian recipes."
    )

class AppState(TypedDict):
    all_messages: Annotated[list, add_messages]

llm = ChatOpenAI(
    base_url="http://10.0.38.50:50015/v1",
    api_key="dummy",
    model="dummy",
    temperature=0.1,
).with_structured_output(ChatResponse)

class Nodes:
    def __init__(self, llm):
        self.llm = llm

    def agent_node(self, state: AppState):
        result: ChatResponse = self.llm.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                *state["all_messages"],
            ]
        )

        return {
            "all_messages": [
                HumanMessage(content=result.model_dump_json())
            ]
        }

builder = StateGraph(AppState)
builder.add_node("agent", Nodes(llm).agent_node)
builder.add_edge(START, "agent")
builder.add_edge("agent", END)

graph = builder.compile(checkpointer=InMemorySaver())

app = FastAPI()

@app.post("/chat", response_model=ChatResponse)
async def chat(
    username: str = Form(...),
    message: str = Form(...),
    image: UploadFile | None = File(None),
):
    content = []

    if message.strip():
        content.append(
            {
                "type": "text",
                "text": message,
            }
        )

    if image is not None:
        image_bytes = await image.read()
        image_b64 = base64.b64encode(image_bytes).decode()

        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image.content_type};base64,{image_b64}"
                },
            }
        )

    state = graph.invoke(
        {
            "all_messages": [
                HumanMessage(content=content)
            ]
        },
        config={
            "configurable": {
                "thread_id": username
            }
        },
    )

    result: ChatResponse = llm.invoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            *state["all_messages"],
        ]
    )

    return result