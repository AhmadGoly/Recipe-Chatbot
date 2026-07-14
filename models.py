from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str = Field(description="Ingredient name in Persian (Farsi)")
    count: int = Field(description="Detected quantity")


class Recipe(BaseModel):
    name: str = Field(description="Persian recipe name")
    available_ingredients: list[str] = Field(default_factory=list)
    missing_ingredients: list[str] = Field(default_factory=list)
    explanation: str = Field(
        description="Why this recipe was suggested"
    )


class ChatResponse(BaseModel):
    response: str = Field(
        description="Assistant response"
    )

    ingredients: list[Ingredient] = Field(
        default_factory=list,
        description="Full current ingredient list (populated by backend, not LLM)"
    )

    added_ingredients: list[Ingredient] = Field(
        default_factory=list,
        description="New ingredients detected in this message that are NOT already in the current list"
    )

    removed_ingredients: list[str] = Field(
        default_factory=list,
        description="Names of ingredients that should be removed (user no longer has them)"
    )

    recipes: list[Recipe] = Field(
        default_factory=list,
        description="Recipe suggestions. After a recipe is selected this list always contains exactly one recipe."
    )


class SelectRecipeRequest(BaseModel):
    username: str
    recipe_index: int = Field(
        ge=0,
        description="Index inside the latest suggested recipe list."
    )


class SelectRecipeResponse(BaseModel):
    success: bool
    recipe: Recipe


class ResetConversationRequest(BaseModel):
    username: str


class ResetConversationResponse(BaseModel):
    success: bool