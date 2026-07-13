from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from models import ChatResponse

from prompts import (
    SUGGEST_RECIPES_PROMPT,
    CONTINUE_RECIPE_PROMPT,
)

from state import AppState


class Nodes:
    def __init__(self, llm):
        self.llm = llm

    def router(self, state: AppState):
        if state["recipe_locked"]:
            return "continue_recipe"

        return "suggest_recipes"

    def suggest_recipes(self, state: AppState):
        result: ChatResponse = self.llm.invoke(
            [
                SystemMessage(content=SUGGEST_RECIPES_PROMPT),
                *state["all_messages"],
            ]
        )

        return {
            "ingredients": result.ingredients,
            "suggested_recipes": result.recipes,
            "last_response": result.response,
            "all_messages": [
                AIMessage(content=result.model_dump_json())
            ]
        }

    def continue_recipe(self, state: AppState):
        recipe = state["selected_recipe"]

        recipe_context = f"""
Selected recipe:

Name:
{recipe.name}

Available ingredients:
{chr(10).join(recipe.available_ingredients)}

Missing ingredients:
{chr(10).join(recipe.missing_ingredients)}

Only continue helping with THIS recipe.
"""

        result: ChatResponse = self.llm.invoke(
            [
                SystemMessage(content=CONTINUE_RECIPE_PROMPT),
                SystemMessage(content=recipe_context),
                *state["all_messages"],
            ]
        )

        selected_recipe = result.recipes[0] if result.recipes else recipe

        return {
            "ingredients": result.ingredients,
            "selected_recipe": selected_recipe,
            "last_response": result.response,
            "all_messages": [
                AIMessage(content=result.model_dump_json())
            ]
        }