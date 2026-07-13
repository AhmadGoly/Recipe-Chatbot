import base64

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from graph import build_graph

from models import (
    ChatResponse,
    ResetConversationRequest,
    ResetConversationResponse,
    SelectRecipeRequest,
    SelectRecipeResponse,
)

from state import AppState


llm = ChatOpenAI(
    base_url="http://10.0.38.50:50015/v1",
    api_key="dummy",
    model="dummy",
    temperature=0.1,
).with_structured_output(ChatResponse)

graph = build_graph(llm)

app = FastAPI()

sessions: dict[str, AppState] = {}


def create_state() -> AppState:
    return {
        "all_messages": [],
        "ingredients": [],
        "suggested_recipes": [],
        "selected_recipe": None,
        "recipe_locked": False,
        "last_response": "",
    }


def get_state(username: str) -> AppState:
    if username not in sessions:
        sessions[username] = create_state()

    return sessions[username]


def build_content(
    message: str,
    image_bytes: bytes | None,
    image_content_type: str | None,
):
    content = []

    if message.strip():
        content.append(
            {
                "type": "text",
                "text": message,
            }
        )

    if image_bytes is not None:
        image_b64 = base64.b64encode(image_bytes).decode()

        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image_content_type};base64,{image_b64}"
                },
            }
        )

    return content


def build_response(state: AppState) -> ChatResponse:
    if state["recipe_locked"] and state["selected_recipe"] is not None:
        recipes = [state["selected_recipe"]]
    else:
        recipes = state["suggested_recipes"]

    return ChatResponse(
        response=state["last_response"],
        ingredients=state["ingredients"],
        recipes=recipes,
    )


@app.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(
    username: str = Form(...),
    message: str = Form(""),
    image: UploadFile | None = File(None),
):
    state = get_state(username)

    image_bytes = None
    image_content_type = None

    if image is not None:
        image_bytes = await image.read()
        image_content_type = image.content_type

    content = build_content(
        message=message,
        image_bytes=image_bytes,
        image_content_type=image_content_type,
    )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Message or image is required.",
        )

    state["all_messages"].append(
        HumanMessage(content=content)
    )

    new_state = graph.invoke(
        state,
        config={
            "configurable": {
                "thread_id": username,
            }
        },
    )

    state.clear()
    state.update(new_state)

    return build_response(state)


@app.post(
    "/select_recipe",
    response_model=SelectRecipeResponse,
)
async def select_recipe(
    request: SelectRecipeRequest,
):
    state = get_state(request.username)

    if state["recipe_locked"]:
        raise HTTPException(
            status_code=400,
            detail="A recipe has already been selected.",
        )

    recipes = state["suggested_recipes"]

    if not recipes:
        raise HTTPException(
            status_code=400,
            detail="No recipes available.",
        )

    if request.recipe_index < 0 or request.recipe_index >= len(recipes):
        raise HTTPException(
            status_code=400,
            detail="Recipe index is out of range.",
        )

    selected_recipe = recipes[request.recipe_index]

    HumanMessage(
    content=f"""
        من این دستور غذا را انتخاب کردم:

        {selected_recipe.model_dump_json(indent=2)}

        از این به بعد فقط برای آماده کردن همین دستور غذا به من کمک کن.
        """
        )

    state["selected_recipe"] = selected_recipe
    state["recipe_locked"] = True
    state["suggested_recipes"] = []

    return SelectRecipeResponse(
        success=True,
        recipe=selected_recipe,
    )


@app.post(
    "/reset",
    response_model=ResetConversationResponse,
)
async def reset(
    request: ResetConversationRequest,
):
    sessions.pop(request.username, None)

    return ResetConversationResponse(
        success=True,
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=12345,
    )