from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph.message import add_messages

from models import Ingredient, Recipe


class AppState(TypedDict):
    all_messages: Annotated[list, add_messages]

    ingredients: list[Ingredient]

    suggested_recipes: list[Recipe]

    selected_recipe: Recipe | None

    recipe_locked: bool

    last_response: str