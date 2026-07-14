from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from models import ChatResponse

from prompts import (
    SUGGEST_RECIPES_PROMPT,
    CONTINUE_RECIPE_PROMPT,
)

from state import AppState


def build_ingredients_context(ingredients: list) -> str:
    if not ingredients:
        return "Current known ingredients: (none)"
    names = [f"{i.name} ({i.count})" for i in ingredients]
    return f"Current known ingredients:\n" + "\n".join(names)


def merge_ingredients(state: AppState, result: ChatResponse):
    for ing in result.added_ingredients:
        if not any(existing.name == ing.name for existing in state["ingredients"]):
            state["ingredients"].append(ing)

    removed_names = set(result.removed_ingredients)
    state["ingredients"] = [
        i for i in state["ingredients"] if i.name not in removed_names
    ]


class Nodes:
    def __init__(self, llm):
        self.llm = llm

    def router(self, state: AppState):
        if state["recipe_locked"]:
            return "continue_recipe"

        return "suggest_recipes"

    def suggest_recipes(self, state: AppState):
        ingredients_context = build_ingredients_context(state["ingredients"])

        try:
            result: ChatResponse = self.llm.invoke(
                [
                    SystemMessage(content=SUGGEST_RECIPES_PROMPT),
                    SystemMessage(content=ingredients_context),
                    *state["all_messages"],
                ]
            )
        except Exception:
            return {
                "last_response": "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
                "all_messages": [
                    AIMessage(content="LLM error occurred in suggest_recipes.")
                ],
            }

        merge_ingredients(state, result)

        return {
            "ingredients": state["ingredients"],
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

        ingredients_context = build_ingredients_context(state["ingredients"])

        try:
            result: ChatResponse = self.llm.invoke(
                [
                    SystemMessage(content=CONTINUE_RECIPE_PROMPT),
                    SystemMessage(content=recipe_context),
                    SystemMessage(content=ingredients_context),
                    *state["all_messages"],
                ]
            )
        except Exception:
            return {
                "last_response": "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
                "all_messages": [
                    AIMessage(content="LLM error occurred in continue_recipe.")
                ],
            }

        merge_ingredients(state, result)

        selected_recipe = result.recipes[0] if result.recipes else recipe

        return {
            "ingredients": state["ingredients"],
            "selected_recipe": selected_recipe,
            "last_response": result.response,
            "all_messages": [
                AIMessage(content=result.model_dump_json())
            ]
        }
