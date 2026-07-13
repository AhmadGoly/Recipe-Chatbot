from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from nodes import Nodes
from state import AppState


def build_graph(llm):
    nodes = Nodes(llm)

    builder = StateGraph(AppState)

    builder.add_node("suggest_recipes", nodes.suggest_recipes)
    builder.add_node("continue_recipe", nodes.continue_recipe)

    builder.add_conditional_edges(
        START,
        nodes.router,
        {
            "suggest_recipes": "suggest_recipes",
            "continue_recipe": "continue_recipe",
        },
    )

    builder.add_edge("suggest_recipes", END)
    builder.add_edge("continue_recipe", END)

    return builder.compile(
        checkpointer=InMemorySaver()
    )